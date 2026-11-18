package com.example.redvsblue

import android.content.Context
import android.os.Build
import android.os.Bundle
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.view.MotionEvent
import android.view.View
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.example.redvsblue.databinding.ActivityGameBinding
import org.json.JSONObject

class GameActivity : AppCompatActivity(), SocketManager.MatchListener {

    private lateinit var binding: ActivityGameBinding
    private var vibrator: Vibrator? = null

    private var myBlueStrikes = 0
    private var myRedStrikes = 0
    private var currentRound = 1
    private var isLocked = false

    companion object {
        const val EXTRA_ROOM_CODE = "extra_room_code"
        const val EXTRA_JUDGE_NAME = "extra_judge_name"
        const val EXTRA_RED_FIGHTER = "extra_red_fighter"
        const val EXTRA_BLUE_FIGHTER = "extra_blue_fighter"
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityGameBinding.inflate(layoutInflater)
        setContentView(binding.root)

        initVibrator()

        val judgeName = intent.getStringExtra(EXTRA_JUDGE_NAME) ?: "JUDGE"
        val redFighter = intent.getStringExtra(EXTRA_RED_FIGHTER) ?: "RED CORNER"
        val blueFighter = intent.getStringExtra(EXTRA_BLUE_FIGHTER) ?: "BLUE CORNER"

        binding.tvJudgeNameBadge.text = judgeName.uppercase()
        binding.tvRedFighterName.text = redFighter.uppercase()
        binding.tvBlueFighterName.text = blueFighter.uppercase()

        SocketManager.setMatchListener(this)
        setupTapListeners()

        binding.btnExit.setOnClickListener {
            finish()
        }
    }

    private fun initVibrator() {
        vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val vibratorManager = getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
            vibratorManager?.defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
        }
    }

    private fun triggerHaptic() {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibrator?.vibrate(VibrationEffect.createOneShot(35, VibrationEffect.DEFAULT_AMPLITUDE))
            } else {
                @Suppress("DEPRECATION")
                vibrator?.vibrate(35)
            }
        } catch (_: Exception) {}
    }

    private fun setupTapListeners() {
        // UPPER HALF: BLUE CORNER (Top 50%)
        binding.btnBlueHalf.setOnTouchListener { view, event ->
            if (event.action == MotionEvent.ACTION_DOWN) {
                if (isLocked) {
                    Toast.makeText(this, "Round is not active", Toast.LENGTH_SHORT).show()
                    return@setOnTouchListener false
                }
                triggerHaptic()
                myBlueStrikes++
                binding.tvMyBlueTaps.text = "Strikes Scored: $myBlueStrikes"
                SocketManager.sendTap("blue")
                view.performClick()
            }
            false
        }

        // LOWER HALF: RED CORNER (Bottom 50%)
        binding.btnRedHalf.setOnTouchListener { view, event ->
            if (event.action == MotionEvent.ACTION_DOWN) {
                if (isLocked) {
                    Toast.makeText(this, "Round is not active", Toast.LENGTH_SHORT).show()
                    return@setOnTouchListener false
                }
                triggerHaptic()
                myRedStrikes++
                binding.tvMyRedTaps.text = "Strikes Scored: $myRedStrikes"
                SocketManager.sendTap("red")
                view.performClick()
            }
            false
        }
    }

    override fun onClockTick(timeRemaining: Int, round: Int, state: String) {
        binding.tvRoundClock.text = formatTime(timeRemaining)
    }

    override fun onRestTick(restRemaining: Int, round: Int, state: String) {
        binding.tvRoundClock.text = "REST: ${restRemaining}s"
    }

    override fun onMatchStateUpdated(data: JSONObject) {
        val state = data.optString("state", "ROUND_ACTIVE")
        val round = data.optInt("currentRound", 1)
        val totalRounds = data.optInt("totalRounds", 3)
        val timeRemaining = data.optInt("roundTimeRemaining", 180)
        val restRemaining = data.optInt("restTimeRemaining", 60)
        val redName = data.optString("redFighter", "")
        val blueName = data.optString("blueFighter", "")

        if (redName.isNotEmpty()) binding.tvRedFighterName.text = redName.uppercase()
        if (blueName.isNotEmpty()) binding.tvBlueFighterName.text = blueName.uppercase()

        if (round != currentRound) {
            currentRound = round
            myBlueStrikes = 0
            myRedStrikes = 0
            binding.tvMyBlueTaps.text = "Strikes Scored: 0"
            binding.tvMyRedTaps.text = "Strikes Scored: 0"
        }

        binding.tvRoundDisplay.text = "ROUND $currentRound OF $totalRounds"

        when (state) {
            "ROUND_ACTIVE" -> {
                isLocked = false
                binding.flLockoutOverlay.visibility = View.GONE
                binding.tvRoundClock.text = formatTime(timeRemaining)
            }
            "ROUND_PAUSED" -> {
                isLocked = true
                binding.flLockoutOverlay.visibility = View.VISIBLE
                binding.tvOverlayTitle.text = "ROUND PAUSED"
                binding.tvOverlaySubtitle.text = "Match is paused by Referee / Admin"
                binding.tvRoundClock.text = formatTime(timeRemaining)
            }
            "ROUND_REST" -> {
                isLocked = true
                binding.flLockoutOverlay.visibility = View.VISIBLE
                binding.tvOverlayTitle.text = "ROUND $currentRound CONCLUDED"
                binding.tvOverlaySubtitle.text = "Rest Interval: ${restRemaining}s. Preparing Round ${currentRound + 1}"
                binding.tvRoundClock.text = "REST: ${restRemaining}s"
            }
            "MATCH_FINISHED" -> {
                isLocked = true
                binding.flLockoutOverlay.visibility = View.VISIBLE
                binding.tvOverlayTitle.text = "BOUT CONCLUDED"
                val decision = data.optString("decision", "Final decision rendered on main board")
                binding.tvOverlaySubtitle.text = decision
                binding.tvRoundClock.text = "FINAL"
            }
            else -> {
                isLocked = true
                binding.flLockoutOverlay.visibility = View.VISIBLE
                binding.tvOverlayTitle.text = "AWAITING ROUND START"
                binding.tvOverlaySubtitle.text = "Referee will ring the opening bell"
            }
        }
    }

    private fun formatTime(seconds: Int): String {
        val m = Math.max(0, seconds) / 60
        val s = Math.max(0, seconds) % 60
        return String.format("%02d:%02d", m, s)
    }

    override fun onDisconnected() {
        Toast.makeText(this, "Disconnected from Arena Server", Toast.LENGTH_SHORT).show()
    }

    override fun onDestroy() {
        super.onDestroy()
        SocketManager.setMatchListener(null)
    }
}
