package com.cubelogistics.placement

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val store = Store(this)
        val firestoreSync = FirestoreSync(this, store)
        firestoreSync.startAutomaticSync()

        setContent {
            CubeApp(store)
        }
    }
}
