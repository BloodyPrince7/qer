package com.example.redvsblue

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.view.View
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.example.redvsblue.databinding.ActivityMainBinding

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        val prefs = getSharedPreferences("BoxingJudgePrefs", Context.MODE_PRIVATE)
        val savedServer = prefs.getString("server_address", "10.190.168.33:3000")
        val savedJudge = prefs.getString("judge_name", "Judge 1")

        binding.etServerAddress.setText(savedServer)
        binding.etPlayerName.setText(savedJudge)

        binding.btnJoin.setOnClickListener {
            attemptJoin()
        }
    }

    private fun attemptJoin() {
        val serverAddress = binding.etServerAddress.text?.toString()?.trim().orEmpty()
        val roomCode = binding.etRoomCode.text?.toString()?.trim()?.uppercase().orEmpty()
        val judgeName = binding.etPlayerName.text?.toString()?.trim().orEmpty()

        if (serverAddress.isEmpty()) {
            binding.tilServerAddress.error = "Please enter server address"
            return
        } else {
            binding.tilServerAddress.error = null
        }

        if (roomCode.isEmpty()) {
            binding.tilRoomCode.error = "Please enter room code"
            return
        } else {
            binding.tilRoomCode.error = null
        }

        val name = if (judgeName.isEmpty()) "Judge 1" else judgeName

        getSharedPreferences("BoxingJudgePrefs", Context.MODE_PRIVATE)
            .edit()
            .putString("server_address", serverAddress)
            .putString("judge_name", name)
            .apply()

        setLoading(true, "Authenticating Judge for Room $roomCode...")

        SocketManager.connect(
            serverUrl = serverAddress,
            roomCode = roomCode,
            judgeName = name,
            onSuccess = { roomData ->
                setLoading(false, "Connected!")
                val redFighter = roomData.optString("redFighter", "Red Corner")
                val blueFighter = roomData.optString("blueFighter", "Blue Corner")

                val intent = Intent(this, GameActivity::class.java).apply {
                    putExtra(GameActivity.EXTRA_ROOM_CODE, roomCode)
                    putExtra(GameActivity.EXTRA_JUDGE_NAME, name)
                    putExtra(GameActivity.EXTRA_RED_FIGHTER, redFighter)
                    putExtra(GameActivity.EXTRA_BLUE_FIGHTER, blueFighter)
                }
                startActivity(intent)
            },
            onError = { errorMessage ->
                setLoading(false, errorMessage)
                binding.tvStatus.setTextColor(getColor(R.color.red_team))
                Toast.makeText(this, errorMessage, Toast.LENGTH_LONG).show()
            }
        )
    }

    private fun setLoading(loading: Boolean, statusMessage: String) {
        binding.progressBar.visibility = if (loading) View.VISIBLE else View.GONE
        binding.btnJoin.isEnabled = !loading
        binding.tvStatus.text = statusMessage
        binding.tvStatus.setTextColor(getColor(R.color.text_secondary))
    }
}
