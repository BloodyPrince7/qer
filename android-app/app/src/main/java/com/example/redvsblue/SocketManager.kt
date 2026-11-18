package com.example.redvsblue

import android.os.Handler
import android.os.Looper
import android.util.Log
import io.socket.client.IO
import io.socket.client.Socket
import org.json.JSONObject
import java.net.URI

object SocketManager {
    private const val TAG = "SocketManager"
    private var socket: Socket? = null
    private val mainHandler = Handler(Looper.getMainLooper())

    var currentRoomCode: String? = null
    var currentJudgeName: String = "Judge 1"

    interface MatchListener {
        fun onMatchStateUpdated(data: JSONObject)
        fun onClockTick(timeRemaining: Int, round: Int, state: String)
        fun onRestTick(restRemaining: Int, round: Int, state: String)
        fun onDisconnected()
    }

    private var matchListener: MatchListener? = null

    fun setMatchListener(listener: MatchListener?) {
        this.matchListener = listener
    }

    /**
     * Connect to Boxing Server at given URL
     * Supports both local Wi-Fi (e.g. 10.190.168.33:3000)
     * and Public Cloud hosts like Render (e.g. https://your-app.onrender.com)
     */
    fun connect(
        serverUrl: String,
        roomCode: String,
        judgeName: String,
        onSuccess: (roomData: JSONObject) -> Unit,
        onError: (message: String) -> Unit
    ) {
        disconnect()

        val trimmed = serverUrl.trim()
        val formattedUrl = if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
            if (trimmed.contains(".onrender.com") || trimmed.contains(".com") || trimmed.contains(".io") || trimmed.contains(".app") || trimmed.contains(".org") || trimmed.contains(".net")) {
                "https://$trimmed"
            } else {
                "http://$trimmed"
            }
        } else {
            trimmed
        }

        try {
            val opts = IO.Options().apply {
                reconnection = true
                reconnectionAttempts = 10
                reconnectionDelay = 1000
                timeout = 10000
                forceNew = true
                transports = arrayOf("websocket", "polling")
            }

            Log.d(TAG, "Connecting to Arena at: $formattedUrl")
            val newSocket = IO.socket(URI.create(formattedUrl), opts)
            socket = newSocket

            currentRoomCode = roomCode.trim().uppercase()
            currentJudgeName = judgeName.trim()

            var responseHandled = false

            newSocket.on(Socket.EVENT_CONNECT) {
                Log.d(TAG, "Socket connected! Emitting join_room for: $currentRoomCode as $currentJudgeName")

                val payload = JSONObject().apply {
                    put("roomCode", currentRoomCode)
                    put("playerName", currentJudgeName)
                    put("judgeName", currentJudgeName)
                    put("isJudge", true)
                    put("deviceName", android.os.Build.MODEL)
                }

                newSocket.emit("join_room", payload, io.socket.client.Ack { args ->
                    if (responseHandled) return@Ack
                    responseHandled = true

                    if (args != null && args.isNotEmpty() && args[0] is JSONObject) {
                        val res = args[0] as JSONObject
                        val success = res.optBoolean("success", false)
                        if (success) {
                            val room = res.optJSONObject("room") ?: JSONObject()
                            mainHandler.post { onSuccess(room) }
                        } else {
                            val err = res.optString("error", "Match room not found")
                            mainHandler.post { onError(err) }
                        }
                    } else {
                        mainHandler.post { onError("Invalid response from arena server") }
                    }
                })
            }

            newSocket.on(Socket.EVENT_CONNECT_ERROR) { args ->
                val errorMsg = if (args.isNotEmpty()) args[0].toString() else "Connection error"
                Log.e(TAG, "Connection error: $errorMsg")
                if (!responseHandled) {
                    responseHandled = true
                    mainHandler.post { onError("Cannot connect to $formattedUrl. Check internet connection or server status.") }
                }
            }

            // Real-time Match Synchronization events
            newSocket.on("match_state_update") { args ->
                if (args.isNotEmpty() && args[0] is JSONObject) {
                    val data = args[0] as JSONObject
                    mainHandler.post {
                        matchListener?.onMatchStateUpdated(data)
                    }
                }
            }

            // Live 1-second clock ticks
            newSocket.on("clock_tick") { args ->
                if (args.isNotEmpty() && args[0] is JSONObject) {
                    val data = args[0] as JSONObject
                    val time = data.optInt("roundTimeRemaining", 0)
                    val round = data.optInt("currentRound", 1)
                    val state = data.optString("state", "ROUND_ACTIVE")
                    mainHandler.post {
                        matchListener?.onClockTick(time, round, state)
                    }
                }
            }

            // Live rest interval countdown
            newSocket.on("rest_tick") { args ->
                if (args.isNotEmpty() && args[0] is JSONObject) {
                    val data = args[0] as JSONObject
                    val rest = data.optInt("restTimeRemaining", 0)
                    val round = data.optInt("currentRound", 1)
                    val state = data.optString("state", "ROUND_REST")
                    mainHandler.post {
                        matchListener?.onRestTick(rest, round, state)
                    }
                }
            }

            newSocket.on(Socket.EVENT_DISCONNECT) {
                mainHandler.post {
                    matchListener?.onDisconnected()
                }
            }

            newSocket.connect()

        } catch (e: Exception) {
            Log.e(TAG, "Socket creation exception", e)
            onError("Invalid server address: ${e.message}")
        }
    }

    /**
     * Send clean strike tap event for Red or Blue team
     */
    fun sendTap(team: String) {
        val s = socket ?: return
        if (!s.connected()) return

        val data = JSONObject().apply {
            put("roomCode", currentRoomCode)
            put("team", team.lowercase())
            put("judgeName", currentJudgeName)
            put("playerName", currentJudgeName)
        }

        s.emit("tap", data)
    }

    fun disconnect() {
        try {
            socket?.disconnect()
            socket?.off()
            socket = null
        } catch (e: Exception) {
            Log.e(TAG, "Error disconnecting socket", e)
        }
    }
}
