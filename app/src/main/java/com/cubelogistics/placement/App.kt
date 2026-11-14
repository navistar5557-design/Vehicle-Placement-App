package com.cubelogistics.placement

import android.app.DatePickerDialog
import android.widget.Toast
import androidx.compose.foundation.clickable
import androidx.compose.ui.platform.LocalContext
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlin.math.max
import kotlinx.coroutines.launch
import com.google.firebase.auth.FirebaseAuth

val CubeBlue = Color(0xFF073B7A)
val CubeBlue2 = Color(0xFF0D4E9B)
val CubeOrange = Color(0xFFFF6500)
val CubeLightBlue = Color(0xFFEAF3FF)
val CubeGreen = Color(0xFF139B47)
val CubeLightGreen = Color(0xFFE7F8EA)
val CubeLightOrange = Color(0xFFFFF0E6)
val CubeBg = Color(0xFFF7F9FD)
val CubeText = Color(0xFF102A56)

val CubeTypography = Typography(
    displayLarge = TextStyle(fontFamily = FontFamily.SansSerif, fontWeight = FontWeight.Black, color = CubeText),
    headlineLarge = TextStyle(fontFamily = FontFamily.SansSerif, fontWeight = FontWeight.Black, color = CubeText),
    headlineMedium = TextStyle(fontFamily = FontFamily.SansSerif, fontWeight = FontWeight.Bold, color = CubeText),
    titleLarge = TextStyle(fontFamily = FontFamily.SansSerif, fontWeight = FontWeight.Bold, color = CubeText),
    titleMedium = TextStyle(fontFamily = FontFamily.SansSerif, fontWeight = FontWeight.Bold, color = CubeText),
    bodyLarge = TextStyle(fontFamily = FontFamily.SansSerif, fontWeight = FontWeight.Medium, color = Color(0xFF111111)),
    bodyMedium = TextStyle(fontFamily = FontFamily.SansSerif, fontWeight = FontWeight.Medium, color = Color(0xFF111111)),
    labelLarge = TextStyle(fontFamily = FontFamily.SansSerif, fontWeight = FontWeight.Bold),
    labelMedium = TextStyle(fontFamily = FontFamily.SansSerif, fontWeight = FontWeight.SemiBold)
)

@Composable
fun CubeApp(store: Store) {
    val context = LocalContext.current
    val auth = remember { FirebaseAuth.getInstance() }
    val roleRepo = remember { UserRoleRepository(context) }
    val firestoreSync = remember { FirestoreSync(context, store) }
    val loginPrefs = remember { context.getSharedPreferences("cube_auth", android.content.Context.MODE_PRIVATE) }
    val rememberLogin = remember { loginPrefs.getBoolean("remember_login", false) }

    if (!rememberLogin && auth.currentUser != null) {
        auth.signOut()
    }

    MaterialTheme(
        typography = CubeTypography,
        colorScheme = lightColorScheme(
            primary = CubeBlue,
            secondary = CubeOrange,
            background = CubeBg,
            surface = Color.White
        )
    ) {
        var loggedIn by remember { mutableStateOf(rememberLogin && auth.currentUser != null) }
        var profile by remember { mutableStateOf<UserProfile?>(null) }
        var profileLoading by remember { mutableStateOf(loggedIn) }
        var syncInProgress by remember { mutableStateOf(false) }
        var syncVersion by remember { mutableIntStateOf(0) }

        fun finishSync(result: Result<Unit>, successMessage: String) {
            syncInProgress = false
            if (result.isSuccess) {
                syncVersion++
                Toast.makeText(context, successMessage, Toast.LENGTH_SHORT).show()
            } else {
                Toast.makeText(context, "Sync failed: " + (result.exceptionOrNull()?.localizedMessage ?: "Please check internet connection"), Toast.LENGTH_LONG).show()
            }
        }

        fun runAutomaticSync() {
            if (syncInProgress) return
            syncInProgress = true
            firestoreSync.startAutomaticSync { result -> finishSync(result, "Sync completed") }
        }

        fun updateFromDatabase() {
            if (syncInProgress) return
            syncInProgress = true
            firestoreSync.downloadCloudSnapshot { result -> finishSync(result, "Data updated from database") }
        }

        fun syncNow() {
            if (syncInProgress) return
            syncInProgress = true
            firestoreSync.uploadLocalSnapshot { uploadResult ->
                if (uploadResult.isFailure) {
                    finishSync(uploadResult, "Sync completed")
                } else {
                    firestoreSync.downloadCloudSnapshot { downloadResult -> finishSync(downloadResult, "Sync completed") }
                }
            }
        }

        fun loadProfile() {
            profileLoading = true
            roleRepo.loadCurrentUser { result ->
                profile = result.getOrNull()
                profileLoading = false
            }
        }

        LaunchedEffect(loggedIn) {
            if (loggedIn && profile == null) loadProfile()
        }

        LaunchedEffect(profile?.uid) {
            if (profile != null && auth.currentUser != null) {
                runAutomaticSync()
                NotificationRegistrar.registerCurrentDevice(profile!!.username)
                LiveNotificationCenter.start(context, profile!!.uid)
            }
        }

        when {
            !loggedIn -> CubeLoginScreen(
                onLoginSuccess = { rememberMe ->
                    loginPrefs.edit().putBoolean("remember_login", rememberMe).apply()
                    loggedIn = true
                    loadProfile()
                }
            )
            profileLoading -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = CubeOrange)
            }
            profile == null -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text("Unable to load user permissions.", color = MaterialTheme.colorScheme.error)
                    Spacer(Modifier.height(10.dp))
                    Button(onClick = { loadProfile() }) { Text("Retry") }
                }
            }
            else -> CubeMainShell(
                store = store,
                profile = profile!!,
                syncInProgress = syncInProgress,
                syncVersion = syncVersion,
                onUpdateData = { updateFromDatabase() },
                onSyncNow = { syncNow() },
                onLogout = {
                    loginPrefs.edit().putBoolean("remember_login", false).apply()
                    LiveNotificationCenter.stop()
                    auth.signOut()
                    profile = null
                    loggedIn = false
                    profileLoading = false
                }
            )
        }
    }
}

@Composable
private fun CubeBrandLogo(large: Boolean) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.Center
    ) {
        Column(horizontalAlignment = Alignment.Start) {
            Text(
                "CUBE",
                color = if (large) Color(0xFF183C86) else Color.White,
                fontWeight = FontWeight.Black,
                fontStyle = FontStyle.Italic,
                fontSize = if (large) 44.sp else 22.sp,
                letterSpacing = if (large) (-2.5).sp else (-1.3).sp,
                lineHeight = if (large) 40.sp else 20.sp
            )
            Text(
                "LOGISTICS",
                color = CubeOrange,
                fontWeight = FontWeight.Black,
                fontStyle = FontStyle.Italic,
                fontSize = if (large) 17.sp else 8.sp,
                letterSpacing = if (large) 1.sp else .4.sp,
                lineHeight = if (large) 16.sp else 8.sp
            )
        }
        Spacer(Modifier.width(if (large) 6.dp else 4.dp))
        Canvas(Modifier.size(if (large) 54.dp else 30.dp)) {
            val cx = size.width / 2f
            val top = size.height * .03f
            val mid = size.height * .42f
            val bottom = size.height * .98f
            val half = size.width * .42f
            val pin = Path().apply {
                moveTo(cx, top)
                cubicTo(cx + half * .72f, top, cx + half, mid * .58f, cx + half, mid)
                cubicTo(cx + half, mid * 1.32f, cx + half * .54f, mid * 1.72f, cx, bottom)
                cubicTo(cx - half * .54f, mid * 1.72f, cx - half, mid * 1.32f, cx - half, mid)
                cubicTo(cx - half, mid * .58f, cx - half * .72f, top, cx, top)
                close()
            }
            drawPath(pin, if (large) Color(0xFF183C86) else Color.White)
            val d = size.width * .24f
            val diamond = Path().apply {
                moveTo(cx, mid - d)
                lineTo(cx + d, mid)
                lineTo(cx, mid + d)
                lineTo(cx - d, mid)
                close()
            }
            drawPath(diamond, CubeOrange)
            val inner = size.width * .13f
            val whiteDiamond = Path().apply {
                moveTo(cx, mid - inner)
                lineTo(cx + inner, mid)
                lineTo(cx, mid + inner)
                lineTo(cx - inner, mid)
                close()
            }
            drawPath(whiteDiamond, Color.White)
        }
    }
}

@Composable
private fun CubeBrandLogo(modifier: Modifier = Modifier, compact: Boolean = false) {
    Row(
        modifier = modifier,
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.Center
    ) {
        Column(
            horizontalAlignment = Alignment.Start,
            verticalArrangement = Arrangement.Center
        ) {
            Text(
                "CUBE",
                color = if (compact) Color.White else CubeBlue,
                fontWeight = FontWeight.Black,
                fontSize = if (compact) 20.sp else 48.sp,
                letterSpacing = (-1).sp
            )
            Text(
                "LOGISTICS",
                color = CubeOrange,
                fontWeight = FontWeight.Black,
                fontSize = if (compact) 8.sp else 20.sp,
                letterSpacing = 1.sp
            )
        }
        Spacer(Modifier.width(if (compact) 5.dp else 10.dp))
        Canvas(Modifier.size(if (compact) 28.dp else 62.dp)) {
            val cx = size.width / 2f
            val top = size.height * .05f
            val mid = size.height * .50f
            val bottom = size.height * .96f
            val half = size.width * .43f
            val pin = Path().apply {
                moveTo(cx, top)
                lineTo(cx + half, mid * .78f)
                lineTo(cx, bottom)
                lineTo(cx - half, mid * .78f)
                close()
            }
            drawPath(pin, if (compact) Color.White else CubeBlue)
            val d = size.width * .24f
            val diamond = Path().apply {
                moveTo(cx, mid - d)
                lineTo(cx + d, mid)
                lineTo(cx, mid + d)
                lineTo(cx - d, mid)
                close()
            }
            drawPath(diamond, CubeOrange)
            val inner = size.width * .12f
            val whiteDiamond = Path().apply {
                moveTo(cx, mid - inner)
                lineTo(cx + inner, mid)
                lineTo(cx, mid + inner)
                lineTo(cx - inner, mid)
                close()
            }
            drawPath(whiteDiamond, Color.White)
        }
    }
}

@Composable
private fun MockupLoginLogo() {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.Center,
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(horizontalAlignment = Alignment.Start) {
            Text(
                "CUBE",
                color = Color(0xFF183C86),
                fontWeight = FontWeight.Black,
                fontStyle = FontStyle.Italic,
                fontSize = 50.sp,
                letterSpacing = (-3).sp,
                lineHeight = 44.sp
            )
            Text(
                "LOGISTICS",
                color = CubeOrange,
                fontWeight = FontWeight.Black,
                fontStyle = FontStyle.Italic,
                fontSize = 19.sp,
                letterSpacing = 1.sp,
                lineHeight = 18.sp
            )
        }
        Spacer(Modifier.width(6.dp))
        Canvas(Modifier.size(58.dp)) {
            val cx = size.width / 2f
            val top = size.height * .03f
            val mid = size.height * .42f
            val bottom = size.height * .98f
            val half = size.width * .42f
            val pin = Path().apply {
                moveTo(cx, top)
                cubicTo(cx + half * .72f, top, cx + half, mid * .58f, cx + half, mid)
                cubicTo(cx + half, mid * 1.32f, cx + half * .54f, mid * 1.72f, cx, bottom)
                cubicTo(cx - half * .54f, mid * 1.72f, cx - half, mid * 1.32f, cx - half, mid)
                cubicTo(cx - half, mid * .58f, cx - half * .72f, top, cx, top)
                close()
            }
            drawPath(pin, Color(0xFF183C86))
            val d = size.width * .24f
            val diamond = Path().apply {
                moveTo(cx, mid - d)
                lineTo(cx + d, mid)
                lineTo(cx, mid + d)
                lineTo(cx - d, mid)
                close()
            }
            drawPath(diamond, CubeOrange)
            val inner = size.width * .13f
            val whiteDiamond = Path().apply {
                moveTo(cx, mid - inner)
                lineTo(cx + inner, mid)
                lineTo(cx, mid + inner)
                lineTo(cx - inner, mid)
                close()
            }
            drawPath(whiteDiamond, Color.White)
        }
    }
}

@Composable
private fun MockupTruckIllustration(modifier: Modifier = Modifier) {
    Canvas(modifier) {
        val w = size.width
        val h = size.height
        val blue = Color(0xFF0C5DB4)
        val deepBlue = Color(0xFF0B2E63)
        val orange = CubeOrange
        val steel = Color(0xFFDAE4F0)

        // Soft circular hero backdrop
        drawCircle(
            brush = Brush.radialGradient(
                colors = listOf(Color(0xFFCFE6FF), Color(0xFFEFF7FF), Color.Transparent),
                center = androidx.compose.ui.geometry.Offset(w * .46f, h * .48f),
                radius = h * .55f
            ),
            radius = h * .52f,
            center = androidx.compose.ui.geometry.Offset(w * .46f, h * .48f)
        )

        // Distant skyline
        val buildings = listOf(
            Triple(.70f,.34f,.055f), Triple(.76f,.27f,.050f), Triple(.82f,.39f,.045f),
            Triple(.87f,.22f,.060f), Triple(.94f,.33f,.045f)
        )
        buildings.forEach { (x, top, bw) ->
            drawRoundRect(
                color = Color(0xFFBFD6F3).copy(alpha = .64f),
                topLeft = androidx.compose.ui.geometry.Offset(w * x, h * top),
                size = androidx.compose.ui.geometry.Size(w * bw, h * (.66f-top)),
                cornerRadius = androidx.compose.ui.geometry.CornerRadius(5f,5f)
            )
        }

        // Curved road
        val road = Path().apply {
            moveTo(w * .03f, h * .78f)
            cubicTo(w * .20f, h * .60f, w * .46f, h * .61f, w * .82f, h * .76f)
        }
        drawPath(
            road,
            Color(0xFFAFC6E4),
            style = androidx.compose.ui.graphics.drawscope.Stroke(width = h * .105f)
        )
        drawPath(
            road,
            Color.White,
            style = androidx.compose.ui.graphics.drawscope.Stroke(width = h * .018f)
        )

        // Blue container with depth and ribs
        drawRoundRect(
            brush = Brush.linearGradient(
                colors = listOf(Color(0xFF123A7E), Color(0xFF0875D1), Color(0xFF0A438E)),
                start = androidx.compose.ui.geometry.Offset(w * .12f, h * .28f),
                end = androidx.compose.ui.geometry.Offset(w * .58f, h * .63f)
            ),
            topLeft = androidx.compose.ui.geometry.Offset(w * .14f, h * .30f),
            size = androidx.compose.ui.geometry.Size(w * .43f, h * .33f),
            cornerRadius = androidx.compose.ui.geometry.CornerRadius(10f,10f)
        )
        repeat(8) { i ->
            val x = w * (.17f + i * .048f)
            drawLine(
                color = Color(0xFF8FC9FF).copy(alpha = .50f),
                start = androidx.compose.ui.geometry.Offset(x, h * .33f),
                end = androidx.compose.ui.geometry.Offset(x, h * .59f),
                strokeWidth = 2f
            )
        }
        drawLine(
            color = orange,
            start = androidx.compose.ui.geometry.Offset(w * .15f, h * .60f),
            end = androidx.compose.ui.geometry.Offset(w * .57f, h * .60f),
            strokeWidth = 4f
        )

        // White detailed cab
        val cab = Path().apply {
            moveTo(w * .55f, h * .34f)
            lineTo(w * .70f, h * .34f)
            cubicTo(w * .735f, h * .34f, w * .755f, h * .38f, w * .765f, h * .43f)
            lineTo(w * .80f, h * .58f)
            cubicTo(w * .81f, h * .62f, w * .78f, h * .65f, w * .74f, h * .65f)
            lineTo(w * .55f, h * .65f)
            close()
        }
        drawPath(
            cab,
            brush = Brush.linearGradient(
                colors = listOf(Color.White, Color(0xFFEAF0F7), Color(0xFFC8D5E5)),
                start = androidx.compose.ui.geometry.Offset(w*.55f,h*.34f),
                end = androidx.compose.ui.geometry.Offset(w*.80f,h*.65f)
            )
        )
        drawPath(
            cab,
            Color(0xFF9FB0C4),
            style = androidx.compose.ui.graphics.drawscope.Stroke(width = 2.2f)
        )

        // Windshield + side glass
        val glass = Path().apply {
            moveTo(w * .595f, h * .38f)
            lineTo(w * .69f, h * .38f)
            lineTo(w * .735f, h * .47f)
            lineTo(w * .585f, h * .47f)
            close()
        }
        drawPath(
            glass,
            brush = Brush.linearGradient(
                colors = listOf(Color(0xFF476C95), Color(0xFF0A203F))
            )
        )
        drawRoundRect(
            color = Color(0xFF2A4668),
            topLeft = androidx.compose.ui.geometry.Offset(w * .585f, h * .51f),
            size = androidx.compose.ui.geometry.Size(w * .17f, h * .055f),
            cornerRadius = androidx.compose.ui.geometry.CornerRadius(5f,5f)
        )
        drawLine(
            color = Color(0xFF9FB0C4),
            start = androidx.compose.ui.geometry.Offset(w * .60f, h * .53f),
            end = androidx.compose.ui.geometry.Offset(w * .735f, h * .53f),
            strokeWidth = 2f
        )
        drawRoundRect(
            color = orange,
            topLeft = androidx.compose.ui.geometry.Offset(w * .735f, h * .58f),
            size = androidx.compose.ui.geometry.Size(w * .035f, h * .025f),
            cornerRadius = androidx.compose.ui.geometry.CornerRadius(4f,4f)
        )
        drawRoundRect(
            color = Color(0xFFF5FAFF),
            topLeft = androidx.compose.ui.geometry.Offset(w * .57f, h * .58f),
            size = androidx.compose.ui.geometry.Size(w * .035f, h * .025f),
            cornerRadius = androidx.compose.ui.geometry.CornerRadius(4f,4f)
        )

        // Mirrors
        drawRoundRect(
            color = deepBlue,
            topLeft = androidx.compose.ui.geometry.Offset(w * .79f, h * .42f),
            size = androidx.compose.ui.geometry.Size(w * .014f, h * .075f),
            cornerRadius = androidx.compose.ui.geometry.CornerRadius(3f,3f)
        )

        // Wheels
        listOf(.22f,.43f,.60f,.735f).forEachIndexed { index, cx ->
            val cy = if (index < 2) .665f else .675f
            drawCircle(deepBlue, radius = h * .064f, center = androidx.compose.ui.geometry.Offset(w*cx,h*cy))
            drawCircle(Color(0xFFB9CBE0), radius = h * .027f, center = androidx.compose.ui.geometry.Offset(w*cx,h*cy))
            drawCircle(Color(0xFF6F8298), radius = h * .010f, center = androidx.compose.ui.geometry.Offset(w*cx,h*cy))
        }

        // Orange location pin and target ring
        val pinX = w * .89f
        val pinY = h * .48f
        drawCircle(orange, radius = h * .075f, center = androidx.compose.ui.geometry.Offset(pinX,pinY))
        val tail = Path().apply {
            moveTo(pinX - h*.042f, pinY + h*.040f)
            lineTo(pinX + h*.042f, pinY + h*.040f)
            lineTo(pinX, pinY + h*.145f)
            close()
        }
        drawPath(tail, orange)
        drawCircle(Color.White, radius = h*.027f, center = androidx.compose.ui.geometry.Offset(pinX,pinY))
        drawOval(
            color = orange.copy(alpha=.82f),
            topLeft = androidx.compose.ui.geometry.Offset(pinX-h*.09f,pinY+h*.14f),
            size = androidx.compose.ui.geometry.Size(h*.18f,h*.038f),
            style = androidx.compose.ui.graphics.drawscope.Stroke(width=2.6f)
        )
    }
}

@Composable
private fun CubeLoginScreen(onLoginSuccess: (Boolean) -> Unit) {
    val context = LocalContext.current
    val auth = remember { FirebaseAuth.getInstance() }
    val roleRepo = remember { UserRoleRepository(context) }
    val loginPrefs = remember { context.getSharedPreferences("cube_auth", android.content.Context.MODE_PRIVATE) }
    var user by remember { mutableStateOf(loginPrefs.getString("saved_username", "") ?: "") }
    var pass by remember { mutableStateOf("") }
    var passwordVisible by remember { mutableStateOf(false) }
    var rememberMe by remember { mutableStateOf(loginPrefs.getBoolean("remember_username", true)) }
    var errorMessage by remember { mutableStateOf("") }
    var loading by remember { mutableStateOf(false) }

    Box(Modifier.fillMaxSize().background(Color.White)) {
        Canvas(Modifier.fillMaxSize()) {
            val topBlue = Path().apply {
                moveTo(0f, 0f)
                lineTo(size.width * .46f, 0f)
                cubicTo(size.width * .35f, size.height * .025f, size.width * .22f, size.height * .045f, 0f, size.height * .10f)
                close()
            }
            drawPath(topBlue, Color(0xFF6EA8F3).copy(alpha = .35f))
            val topOrange = Path().apply {
                moveTo(0f, size.height * .055f)
                cubicTo(size.width * .16f, size.height * .015f, size.width * .27f, size.height * .020f, size.width * .39f, 0f)
                lineTo(size.width * .28f, 0f)
                cubicTo(size.width * .18f, size.height * .015f, size.width * .09f, size.height * .035f, 0f, size.height * .075f)
                close()
            }
            drawPath(topOrange, CubeOrange.copy(alpha = .18f))

            val wave1 = Path().apply {
                moveTo(0f, size.height * .94f)
                cubicTo(size.width * .25f, size.height * .90f, size.width * .55f, size.height * .98f, size.width, size.height * .88f)
                lineTo(size.width, size.height)
                lineTo(0f, size.height)
                close()
            }
            drawPath(wave1, Color(0xFF86B6F5).copy(alpha = .55f))
            val wave2 = Path().apply {
                moveTo(0f, size.height * .965f)
                cubicTo(size.width * .32f, size.height * .91f, size.width * .62f, size.height * .99f, size.width, size.height * .91f)
                lineTo(size.width, size.height)
                lineTo(0f, size.height)
                close()
            }
            drawPath(wave2, CubeBlue)
            val wave3 = Path().apply {
                moveTo(0f, size.height * .925f)
                cubicTo(size.width * .42f, size.height * .98f, size.width * .72f, size.height * .92f, size.width, size.height * .86f)
                lineTo(size.width, size.height * .90f)
                cubicTo(size.width * .70f, size.height * .96f, size.width * .40f, size.height, 0f, size.height * .94f)
                close()
            }
            drawPath(wave3, CubeOrange.copy(alpha = .22f))
        }

        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 30.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Spacer(Modifier.height(54.dp))
            MockupLoginLogo()

            Spacer(Modifier.height(18.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.width(38.dp).height(1.dp).background(CubeOrange))
                Spacer(Modifier.width(10.dp))
                Text(
                    "Vehicle Placement",
                    color = Color(0xFF153A78),
                    fontWeight = FontWeight.Medium,
                    fontSize = 21.sp
                )
                Spacer(Modifier.width(10.dp))
                Box(Modifier.width(38.dp).height(1.dp).background(CubeOrange))
            }

            Spacer(Modifier.height(18.dp))
            MockupTruckIllustration(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(205.dp)
            )

            Spacer(Modifier.height(8.dp))

            OutlinedTextField(
                value = user,
                onValueChange = { user = it },
                placeholder = { Text("Username", fontSize = 15.sp, color = Color(0xFF606A7A)) },
                leadingIcon = {
                    Icon(
                        Icons.Default.PersonOutline,
                        contentDescription = null,
                        tint = Color(0xFF313844),
                        modifier = Modifier.size(24.dp)
                    )
                },
                singleLine = true,
                shape = RoundedCornerShape(15.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = Color(0xFF9EBBE4),
                    unfocusedBorderColor = Color(0xFFB7C9E5),
                    cursorColor = CubeBlue,
                    focusedContainerColor = Color.White.copy(alpha = .96f),
                    unfocusedContainerColor = Color.White.copy(alpha = .96f)
                ),
                modifier = Modifier.fillMaxWidth().height(62.dp)
            )

            Spacer(Modifier.height(12.dp))

            OutlinedTextField(
                value = pass,
                onValueChange = { pass = it },
                placeholder = { Text("Password", fontSize = 15.sp, color = Color(0xFF606A7A)) },
                leadingIcon = {
                    Icon(
                        Icons.Default.Lock,
                        contentDescription = null,
                        tint = Color(0xFF313844),
                        modifier = Modifier.size(23.dp)
                    )
                },
                trailingIcon = {
                    IconButton(onClick = { passwordVisible = !passwordVisible }) {
                        Icon(
                            if (passwordVisible) Icons.Default.VisibilityOff else Icons.Default.Visibility,
                            contentDescription = if (passwordVisible) "Hide password" else "Show password",
                            tint = Color(0xFF313844),
                            modifier = Modifier.size(21.dp)
                        )
                    }
                },
                visualTransformation = if (passwordVisible) VisualTransformation.None else PasswordVisualTransformation(),
                singleLine = true,
                shape = RoundedCornerShape(15.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = Color(0xFF9EBBE4),
                    unfocusedBorderColor = Color(0xFFB7C9E5),
                    cursorColor = CubeBlue,
                    focusedContainerColor = Color.White.copy(alpha = .96f),
                    unfocusedContainerColor = Color.White.copy(alpha = .96f)
                ),
                modifier = Modifier.fillMaxWidth().height(62.dp)
            )

            Spacer(Modifier.height(8.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Checkbox(
                    checked = rememberMe,
                    onCheckedChange = { rememberMe = it },
                    colors = CheckboxDefaults.colors(
                        checkedColor = CubeOrange,
                        uncheckedColor = CubeOrange,
                        checkmarkColor = Color.White
                    ),
                    modifier = Modifier.size(34.dp)
                )
                Text(
                    "Remember Me",
                    color = Color(0xFF142A58),
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold
                )
                Spacer(Modifier.weight(1f))
                Text(
                    "Forgot Password?",
                    color = CubeOrange,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.clickable {
                        val identity = user.trim()
                        if (identity.isBlank()) {
                            errorMessage = "Enter your User ID first."
                        } else if (!identity.contains("@")) {
                            errorMessage = "For username accounts, please contact Admin to change the password."
                        } else {
                            loading = true
                            auth.sendPasswordResetEmail(identity)
                                .addOnSuccessListener {
                                    loading = false
                                    errorMessage = "Password reset email sent."
                                }
                                .addOnFailureListener {
                                    loading = false
                                    errorMessage = it.localizedMessage ?: "Unable to send password reset email."
                                }
                        }
                    }
                )
            }

            if (errorMessage.isNotBlank()) {
                Text(
                    errorMessage,
                    color = if (errorMessage == "Password reset email sent.") CubeGreen else MaterialTheme.colorScheme.error,
                    fontSize = 11.sp,
                    modifier = Modifier.fillMaxWidth().padding(top = 6.dp)
                )
            }

            Spacer(Modifier.height(16.dp))

            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(58.dp)
                    .clip(RoundedCornerShape(16.dp))
                    .background(
                        Brush.horizontalGradient(
                            listOf(Color(0xFF1458C8), Color(0xFF073B7A))
                        )
                    )
                    .clickable(enabled = !loading) {
                        val identity = user.trim()
                        errorMessage = when {
                            identity.isBlank() -> "Enter your User ID."
                            pass.isBlank() -> "Enter your password."
                            else -> ""
                        }
                        if (errorMessage.isBlank()) {
                            loading = true
                            val loginEmail = roleRepo.resolveLoginIdentity(identity)
                            auth.signInWithEmailAndPassword(loginEmail, pass)
                                .addOnSuccessListener {
                                    loading = false
                                    if (rememberMe) {
                                        loginPrefs.edit()
                                            .putString("saved_username", identity)
                                            .putBoolean("remember_username", true)
                                            .apply()
                                    } else {
                                        loginPrefs.edit()
                                            .remove("saved_username")
                                            .putBoolean("remember_username", false)
                                            .apply()
                                    }
                                    onLoginSuccess(rememberMe)
                                }
                                .addOnFailureListener {
                                    loading = false
                                    errorMessage = when {
                                        it.message?.contains("password", ignoreCase = true) == true ||
                                            it.message?.contains("credential", ignoreCase = true) == true ->
                                            "Invalid email or password."
                                        else -> it.localizedMessage ?: "Login failed. Please try again."
                                    }
                                }
                        }
                    },
                contentAlignment = Alignment.Center
            ) {
                if (loading) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(22.dp),
                        strokeWidth = 2.dp,
                        color = Color.White
                    )
                } else {
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(horizontal = 28.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Spacer(Modifier.weight(1f))
                        Text("Login", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 18.sp)
                        Spacer(Modifier.weight(1f))
                        Icon(Icons.Default.ArrowForward, null, tint = Color.White, modifier = Modifier.size(24.dp))
                    }
                }
            }

            Spacer(Modifier.height(28.dp))

            Text(
                buildAnnotatedString {
                    append("C.U.B.E. - ")
                    withStyle(SpanStyle(fontWeight = FontWeight.Bold, fontStyle = FontStyle.Italic)) { append("Customers") }
                    withStyle(SpanStyle(fontStyle = FontStyle.Italic)) { append(" who inspire us. ") }
                    withStyle(SpanStyle(fontWeight = FontWeight.Bold, fontStyle = FontStyle.Italic)) { append("Universe") }
                    withStyle(SpanStyle(fontStyle = FontStyle.Italic)) { append(" that enables us.\n") }
                    withStyle(SpanStyle(fontWeight = FontWeight.Bold, fontStyle = FontStyle.Italic)) { append("Business partners") }
                    withStyle(SpanStyle(fontStyle = FontStyle.Italic)) { append(" who support us. ") }
                    withStyle(SpanStyle(fontWeight = FontWeight.Bold, fontStyle = FontStyle.Italic)) { append("Employees") }
                    withStyle(SpanStyle(fontStyle = FontStyle.Italic)) { append(" who make it all possible.") }
                },
                color = Color(0xFF14213D),
                fontFamily = FontFamily.SansSerif,
                fontSize = 11.sp,
                lineHeight = 17.sp,
                modifier = Modifier.fillMaxWidth()
            )

            Spacer(Modifier.height(110.dp))
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun CubeMainShell(
    store: Store,
    profile: UserProfile,
    syncInProgress: Boolean,
    syncVersion: Int,
    onUpdateData: () -> Unit,
    onSyncNow: () -> Unit,
    onLogout: () -> Unit
) {
    var page by remember { mutableStateOf("Home") }
    var breakdown by remember { mutableStateOf("Trips") }
    val drawerState = rememberDrawerState(initialValue = DrawerValue.Closed)
    val scope = rememberCoroutineScope()

    val now = remember { Calendar.getInstance() }
    var monthYear by remember { mutableStateOf(now.get(Calendar.YEAR) to now.get(Calendar.MONTH)) }
    var customMode by remember { mutableStateOf(false) }
    var customStart by remember { mutableStateOf<Long?>(null) }
    var customEnd by remember { mutableStateOf<Long?>(null) }

    val range = remember(monthYear, customMode, customStart, customEnd) {
        if (customMode && customStart != null && customEnd != null) {
            DashboardRange(customStart!!, endOfDay(customEnd!!), "Custom")
        } else {
            monthRange(monthYear.first, monthYear.second)
        }
    }

    ModalNavigationDrawer(
        drawerState = drawerState,
        drawerContent = {
            ModalDrawerSheet(
                drawerContainerColor = Color.White,
                modifier = Modifier.width(290.dp)
            ) {
                Box(
                    Modifier.fillMaxWidth().background(CubeBlue).padding(18.dp)
                ) {
                    Column {
                        CubeBrandLogo(large = false)
                        Spacer(Modifier.height(8.dp))
                        Text("Vehicle Placement App", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                        Text(profile.username, color = Color.White.copy(alpha = .85f), fontSize = 11.sp)
                        Text(profile.role.name, color = CubeOrange, fontWeight = FontWeight.Black, fontSize = 11.sp)
                    }
                }
                Spacer(Modifier.height(10.dp))
                DrawerMenuItem("Home", Icons.Default.Home) {
                    page = "Home"
                    scope.launch { drawerState.close() }
                }
                if (profile.role.canCreateTrips) {
                    DrawerMenuItem("New Trip", Icons.Default.AddCircleOutline) {
                        page = "New Trip"
                        scope.launch { drawerState.close() }
                    }
                }
                DrawerMenuItem("Trip List", Icons.Default.LocalShipping) {
                    page = "Trip List"
                    scope.launch { drawerState.close() }
                }
                DrawerMenuItem("Reports", Icons.Default.BarChart) {
                    page = "Reports"
                    scope.launch { drawerState.close() }
                }
                if (profile.role.canManageMasters) {
                    DrawerMenuItem("Masters", Icons.Default.Settings) {
                        page = "Masters"
                        scope.launch { drawerState.close() }
                    }
                }
                DrawerMenuItem("Settings", Icons.Default.AdminPanelSettings) {
                    page = "Settings"
                    scope.launch { drawerState.close() }
                }
            }
        }
    ) {
        Scaffold(
            containerColor = CubeBg,
            topBar = {
                TopAppBar(
                    title = {
                        if (page == "Home") {
                            CubeBrandLogo(large = false)
                        } else {
                            Text(page, fontWeight = FontWeight.Bold)
                        }
                    },
                    navigationIcon = {
                        if (page != "Home") {
                            IconButton(onClick = { page = "Home" }) {
                                Icon(Icons.Default.ArrowBack, null, tint = Color.White)
                            }
                        } else {
                            IconButton(onClick = { scope.launch { drawerState.open() } }) {
                                Icon(Icons.Default.Menu, null, tint = Color.White)
                            }
                        }
                    },
                    actions = {
                        UserProfileMenu(
                            profile = profile,
                            syncInProgress = syncInProgress,
                            onUpdateData = onUpdateData,
                            onSyncNow = onSyncNow,
                            onLogout = onLogout
                        )
                    },
                    colors = TopAppBarDefaults.topAppBarColors(
                        containerColor = CubeBlue,
                        titleContentColor = Color.White
                    )
                )
            },
            bottomBar = {
                NavigationBar(containerColor = Color.White, tonalElevation = 6.dp) {
                    BottomItem("Home", Icons.Default.Home, page == "Home") { page = "Home" }
                    BottomItem("Trips", Icons.Default.LocalShipping, page == "Trip List") { page = "Trip List" }
                    if (profile.role.canCreateTrips) {
                        BottomItem("New Trip", Icons.Default.AddCircleOutline, page == "New Trip") { page = "New Trip" }
                    }
                    if (profile.role.canManageMasters) {
                        BottomItem("Masters", Icons.Default.Settings, page == "Masters") { page = "Masters" }
                    }
                }
            }
        ) { pad ->
            Column(Modifier.padding(pad).fillMaxSize()) {
                if (syncInProgress) {
                    Surface(
                        color = CubeLightBlue,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Row(
                            Modifier.padding(horizontal = 12.dp, vertical = 7.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(16.dp),
                                strokeWidth = 2.dp,
                                color = CubeOrange
                            )
                            Spacer(Modifier.width(8.dp))
                            Text("Data is updating...", color = CubeBlue, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }
                Box(Modifier.weight(1f).fillMaxWidth()) {
                    key(syncVersion) {
                        when (page) {
                    "Home" -> CubeDashboard(
                        store = store,
                        range = range,
                        monthYear = monthYear,
                        customMode = customMode,
                        customStart = customStart,
                        customEnd = customEnd,
                        onMonthChange = { y, m -> monthYear = y to m },
                        onCustomModeChange = { customMode = it },
                        onCustomStart = { customStart = it },
                        onCustomEnd = { customEnd = it },
                        onBreakdown = { kind -> breakdown = kind; page = "Dashboard Breakdown" },
                        role = profile.role,
                        go = { page = it }
                    )
                    "Dashboard Breakdown" -> DashboardBreakdownScreen(store, range, breakdown)
                    "New Trip" -> if (profile.role.canCreateTrips) StyledTripEntryScreen(
                        store = store,
                        createdBy = profile.username,
                        createdByEmail = profile.loginEmail
                    ) { page = "Trip List" } else AccessDeniedScreen()
                    "Trip List" -> StyledTripListScreen(
                        store = store,
                        currentUser = profile.username,
                        currentUserEmail = profile.loginEmail,
                        canEdit = profile.role.isAdmin,
                        canDelete = profile.role.canDeleteTrips
                    )
                    "Reports" -> StyledReportsHome(store) { page = it }
                    "Trip Details Report" -> StyledGenericReport(store, "Trip Details Report")
                    "Vendor-wise Report" -> StyledGenericReport(store, "Vendor-wise Report")
                    "Vehicle-wise Report" -> StyledVehicleReport(store)
                    "Expense Summary Report" -> StyledGenericReport(store, "Expense Summary Report")
                    "Margin / Profitability Report" -> StyledGenericReport(store, "Margin / Profitability Report")
                    "Masters" -> if (profile.role.canManageMasters) StyledMastersScreen(store, canEditDelete = profile.role.isAdmin) else AccessDeniedScreen()
                    "Settings" -> SettingsScreen(profile)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun SettingsScreen(profile: UserProfile) {
    val context = LocalContext.current
    val repo = remember { UserRoleRepository(context) }
    var tab by remember { mutableStateOf("Users") }
    var roles by remember { mutableStateOf<List<RoleDefinition>>(emptyList()) }
    var users by remember { mutableStateOf<List<UserProfile>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    var message by remember { mutableStateOf("") }

    fun refresh() {
        loading = true
        repo.ensureDefaultRoles {
            repo.listRoles { roleResult ->
                roles = roleResult.getOrDefault(emptyList())
                repo.listUsers { userResult ->
                    users = userResult.getOrDefault(emptyList())
                    message = userResult.exceptionOrNull()?.localizedMessage
                        ?: roleResult.exceptionOrNull()?.localizedMessage.orEmpty()
                    loading = false
                }
            }
        }
    }

    LaunchedEffect(Unit) { refresh() }

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(12.dp)) {
        Surface(
            color = CubeLightBlue,
            shape = RoundedCornerShape(8.dp),
            modifier = Modifier.fillMaxWidth().padding(bottom = 8.dp)
        ) {
            Row(Modifier.padding(horizontal = 10.dp, vertical = 9.dp), verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Default.AdminPanelSettings, null, tint = CubeOrange)
                Spacer(Modifier.width(8.dp))
                Column {
                    Text("Settings", color = CubeBlue, fontWeight = FontWeight.Black, fontSize = 16.sp)
                    Text(
                        if (profile.role.canManageUsers) "Manage application roles and users"
                        else "View account role and access permissions",
                        fontSize = 10.sp,
                        color = Color.Gray
                    )
                }
            }
        }

        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            FilterChip(
                selected = tab == "Users",
                onClick = { tab = "Users" },
                label = { Text("Users") },
                leadingIcon = { Icon(Icons.Default.ManageAccounts, null, modifier = Modifier.size(18.dp)) }
            )
            FilterChip(
                selected = tab == "Roles",
                onClick = { tab = "Roles" },
                label = { Text("Roles") },
                leadingIcon = { Icon(Icons.Default.Badge, null, modifier = Modifier.size(18.dp)) }
            )
        }

        if (message.isNotBlank()) {
            Spacer(Modifier.height(6.dp))
            Text(message, fontSize = 11.sp, color = if (message.contains("saved", true) || message.contains("created", true) || message.contains("updated", true)) CubeGreen else MaterialTheme.colorScheme.error)
        }

        Spacer(Modifier.height(10.dp))
        if (loading) {
            Box(Modifier.fillMaxWidth().padding(30.dp), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = CubeOrange)
            }
        } else if (profile.role.canManageUsers) {
            if (tab == "Users") {
                AdminUsersPanel(repo, roles, users, onMessage = { message = it }, onRefresh = { refresh() })
            } else {
                AdminRolesPanel(repo, roles, onMessage = { message = it }, onRefresh = { refresh() })
            }
        } else {
            ReadOnlySettingsPanel(profile, roles)
        }
        Spacer(Modifier.height(24.dp))
    }
}

@Composable
private fun ReadOnlySettingsPanel(
    profile: UserProfile,
    roles: List<RoleDefinition>
) {
    Card(
        colors = CardDefaults.cardColors(containerColor = Color.White),
        shape = RoundedCornerShape(12.dp),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(Modifier.padding(14.dp)) {
            Text("My Account", color = CubeBlue, fontWeight = FontWeight.Black, fontSize = 15.sp)
            Spacer(Modifier.height(8.dp))
            Text("Username", fontSize = 10.sp, color = Color.Gray)
            Text(profile.username, fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(6.dp))
            Text("Assigned Role", fontSize = 10.sp, color = Color.Gray)
            Text(profile.role.name, color = CubeOrange, fontWeight = FontWeight.Black)
        }
    }

    Spacer(Modifier.height(14.dp))
    Text("Available Roles", color = CubeBlue, fontWeight = FontWeight.Black)
    Spacer(Modifier.height(6.dp))
    roles.forEach { role ->
        Card(
            colors = CardDefaults.cardColors(containerColor = Color.White),
            shape = RoundedCornerShape(10.dp),
            modifier = Modifier.fillMaxWidth().padding(bottom = 8.dp)
        ) {
            Column(Modifier.padding(12.dp)) {
                Text(role.name, color = CubeBlue, fontWeight = FontWeight.Black)
                Text(
                    listOfNotNull(
                        "Create Trips".takeIf { role.canCreateTrips },
                        "Masters".takeIf { role.canManageMasters },
                        "Delete Trips".takeIf { role.canDeleteTrips },
                        "Reports".takeIf { role.canViewReports },
                        "Manage Users".takeIf { role.canManageUsers }
                    ).joinToString(" • ").ifBlank { "View only" },
                    fontSize = 10.sp,
                    color = Color.Gray
                )
            }
        }
    }

    Surface(
        color = CubeLightBlue,
        shape = RoundedCornerShape(10.dp),
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Default.Lock, null, tint = CubeBlue)
            Spacer(Modifier.width(8.dp))
            Text(
                "Only Admin can create or edit roles and users.",
                fontSize = 11.sp,
                color = CubeText,
                fontWeight = FontWeight.SemiBold
            )
        }
    }
}

@Composable
private fun AdminUsersPanel(
    repo: UserRoleRepository,
    roles: List<RoleDefinition>,
    users: List<UserProfile>,
    onMessage: (String) -> Unit,
    onRefresh: () -> Unit
) {
    var username by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var roleId by remember(roles) { mutableStateOf(roles.firstOrNull { it.id == "user" }?.id ?: roles.firstOrNull()?.id.orEmpty()) }
    var roleMenu by remember { mutableStateOf(false) }

    Card(colors = CardDefaults.cardColors(containerColor = Color.White), shape = RoundedCornerShape(12.dp), modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(14.dp)) {
            Text("Create User", color = CubeBlue, fontWeight = FontWeight.Black, fontSize = 15.sp)
            Spacer(Modifier.height(10.dp))
            OutlinedTextField(
                value = username,
                onValueChange = { username = it },
                label = { Text("Username") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )
            Spacer(Modifier.height(8.dp))
            OutlinedTextField(
                value = password,
                onValueChange = { password = it },
                label = { Text("Password (minimum 6 characters)") },
                visualTransformation = PasswordVisualTransformation(),
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )
            Spacer(Modifier.height(8.dp))
            Box {
                OutlinedButton(onClick = { roleMenu = true }, modifier = Modifier.fillMaxWidth()) {
                    Text("Role: " + (roles.firstOrNull { it.id == roleId }?.name ?: "Select Role"), Modifier.weight(1f))
                    Icon(Icons.Default.KeyboardArrowDown, null)
                }
                DropdownMenu(expanded = roleMenu, onDismissRequest = { roleMenu = false }) {
                    roles.forEach { role ->
                        DropdownMenuItem(
                            text = { Text(role.name) },
                            onClick = { roleId = role.id; roleMenu = false }
                        )
                    }
                }
            }
            Spacer(Modifier.height(10.dp))
            Button(
                onClick = {
                    repo.createUser(username, password, roleId) { result ->
                        if (result.isSuccess) {
                            username = ""
                            password = ""
                            onMessage("User created successfully")
                            onRefresh()
                        } else {
                            onMessage(result.exceptionOrNull()?.localizedMessage ?: "Unable to create user")
                        }
                    }
                },
                enabled = username.isNotBlank() && password.length >= 6 && roleId.isNotBlank(),
                colors = ButtonDefaults.buttonColors(containerColor = CubeOrange),
                modifier = Modifier.fillMaxWidth()
            ) {
                Icon(Icons.Default.PersonAdd, null)
                Spacer(Modifier.width(6.dp))
                Text("Create User", fontWeight = FontWeight.Bold)
            }
        }
    }

    Spacer(Modifier.height(14.dp))
    Text("Existing Users", color = CubeBlue, fontWeight = FontWeight.Black)
    Spacer(Modifier.height(6.dp))

    users.forEach { user ->
        var open by remember(user.uid) { mutableStateOf(false) }
        Card(colors = CardDefaults.cardColors(containerColor = Color.White), shape = RoundedCornerShape(10.dp), modifier = Modifier.fillMaxWidth().padding(bottom = 8.dp)) {
            Column(Modifier.padding(12.dp)) {
                Text(user.username, fontWeight = FontWeight.Black, color = CubeBlue)
                Text(user.role.name, fontSize = 11.sp, color = CubeOrange, fontWeight = FontWeight.Bold)
                Spacer(Modifier.height(7.dp))
                Box {
                    OutlinedButton(onClick = { open = true }, modifier = Modifier.fillMaxWidth()) {
                        Text("Change Role", Modifier.weight(1f), fontSize = 11.sp)
                        Icon(Icons.Default.KeyboardArrowDown, null)
                    }
                    DropdownMenu(expanded = open, onDismissRequest = { open = false }) {
                        roles.forEach { role ->
                            DropdownMenuItem(
                                text = { Text(role.name) },
                                onClick = {
                                    open = false
                                    repo.updateUserRole(user.uid, role.id) { result ->
                                        if (result.isSuccess) {
                                            onMessage("User role updated")
                                            onRefresh()
                                        } else onMessage(result.exceptionOrNull()?.localizedMessage ?: "Unable to update role")
                                    }
                                }
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun AdminRolesPanel(
    repo: UserRoleRepository,
    roles: List<RoleDefinition>,
    onMessage: (String) -> Unit,
    onRefresh: () -> Unit
) {
    var name by remember { mutableStateOf("") }
    var createTrips by remember { mutableStateOf(true) }
    var masters by remember { mutableStateOf(false) }
    var deleteTrips by remember { mutableStateOf(false) }
    var reports by remember { mutableStateOf(true) }
    var users by remember { mutableStateOf(false) }

    fun roleId(value: String): String = value.trim().lowercase().replace(Regex("[^a-z0-9]+"), "-").trim('-')

    Card(colors = CardDefaults.cardColors(containerColor = Color.White), shape = RoundedCornerShape(12.dp), modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(14.dp)) {
            Text("Create Role", color = CubeBlue, fontWeight = FontWeight.Black, fontSize = 15.sp)
            Text("Example: Admin, User, Manager, Accounts", fontSize = 10.sp, color = Color.Gray)
            Spacer(Modifier.height(8.dp))
            OutlinedTextField(value = name, onValueChange = { name = it }, label = { Text("Role Name") }, singleLine = true, modifier = Modifier.fillMaxWidth())
            Spacer(Modifier.height(8.dp))
            PermissionCheck("Create / Save Trips", createTrips) { createTrips = it }
            PermissionCheck("Manage Masters", masters) { masters = it }
            PermissionCheck("Delete Trips", deleteTrips) { deleteTrips = it }
            PermissionCheck("View Reports", reports) { reports = it }
            PermissionCheck("Manage Roles & Users", users) { users = it }
            Spacer(Modifier.height(8.dp))
            Button(
                onClick = {
                    val id = roleId(name)
                    val role = RoleDefinition(id, name.trim(), createTrips, masters, deleteTrips, reports, users)
                    repo.createRole(role) { result ->
                        if (result.isSuccess) {
                            name = ""
                            onMessage("Role created successfully")
                            onRefresh()
                        } else onMessage(result.exceptionOrNull()?.localizedMessage ?: "Unable to create role")
                    }
                },
                enabled = name.trim().length >= 2,
                colors = ButtonDefaults.buttonColors(containerColor = CubeOrange),
                modifier = Modifier.fillMaxWidth()
            ) {
                Icon(Icons.Default.Add, null)
                Spacer(Modifier.width(6.dp))
                Text("Create Role", fontWeight = FontWeight.Bold)
            }
        }
    }

    Spacer(Modifier.height(14.dp))
    Text("Available Roles", color = CubeBlue, fontWeight = FontWeight.Black)
    Spacer(Modifier.height(6.dp))
    roles.forEach { role ->
        Card(colors = CardDefaults.cardColors(containerColor = Color.White), shape = RoundedCornerShape(10.dp), modifier = Modifier.fillMaxWidth().padding(bottom = 8.dp)) {
            Column(Modifier.padding(12.dp)) {
                Text(role.name, color = CubeBlue, fontWeight = FontWeight.Black)
                Text(
                    listOfNotNull(
                        "Trips".takeIf { role.canCreateTrips },
                        "Masters".takeIf { role.canManageMasters },
                        "Delete".takeIf { role.canDeleteTrips },
                        "Reports".takeIf { role.canViewReports },
                        "Users".takeIf { role.canManageUsers }
                    ).joinToString(" • ").ifBlank { "No permissions" },
                    fontSize = 10.sp,
                    color = Color.Gray
                )
            }
        }
    }
}

@Composable
private fun PermissionCheck(label: String, checked: Boolean, onChecked: (Boolean) -> Unit) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Checkbox(checked = checked, onCheckedChange = onChecked)
        Text(label, fontSize = 12.sp)
    }
}


@Composable
private fun AccessDeniedScreen() {
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Icon(Icons.Default.Lock, null, tint = CubeBlue, modifier = Modifier.size(42.dp))
            Spacer(Modifier.height(10.dp))
            Text("Access restricted", fontWeight = FontWeight.Black, color = CubeBlue)
            Text("Your user role does not allow this action.", fontSize = 12.sp, color = Color.Gray)
        }
    }
}

@Composable
private fun UserProfileMenu(
    profile: UserProfile,
    syncInProgress: Boolean,
    onUpdateData: () -> Unit,
    onSyncNow: () -> Unit,
    onLogout: () -> Unit
) {
    val context = LocalContext.current
    val appVersion = remember {
        try {
            context.packageManager.getPackageInfo(context.packageName, 0).versionName ?: "-"
        } catch (_: Exception) {
            "-"
        }
    }
    var expanded by remember { mutableStateOf(false) }
    val initial = profile.username.trim().firstOrNull()?.uppercaseChar()?.toString() ?: "U"

    Box {
        Surface(
            onClick = { expanded = true },
            shape = RoundedCornerShape(24.dp),
            color = Color.White,
            tonalElevation = 0.dp,
            shadowElevation = 1.dp,
            modifier = Modifier
                .padding(end = 8.dp)
                .height(42.dp)
        ) {
            Row(
                modifier = Modifier.padding(start = 5.dp, end = 8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Surface(
                    shape = RoundedCornerShape(50),
                    color = Color(0xFF47B9B2),
                    modifier = Modifier.size(30.dp)
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Text(
                            initial,
                            color = Color.White,
                            fontWeight = FontWeight.Black,
                            fontSize = 13.sp
                        )
                    }
                }
                Spacer(Modifier.width(7.dp))
                Column(
                    modifier = Modifier.widthIn(min = 72.dp, max = 125.dp),
                    verticalArrangement = Arrangement.Center
                ) {
                    Text(
                        profile.username,
                        color = Color(0xFF333333),
                        fontWeight = FontWeight.Bold,
                        fontSize = 11.sp,
                        maxLines = 1
                    )
                    Text(
                        profile.role.name.uppercase(Locale.US),
                        color = Color(0xFF20A99F),
                        fontWeight = FontWeight.Black,
                        fontSize = 8.sp,
                        maxLines = 1
                    )
                }
                Icon(
                    Icons.Default.KeyboardArrowDown,
                    contentDescription = "Open profile menu",
                    tint = Color(0xFF777777),
                    modifier = Modifier.size(18.dp)
                )
            }
        }

        DropdownMenu(
            expanded = expanded,
            onDismissRequest = { expanded = false },
            shape = RoundedCornerShape(10.dp),
            containerColor = Color.White
        ) {
            DropdownMenuItem(
                text = {
                    Column {
                        Text(
                            "App Version",
                            fontSize = 10.sp,
                            color = Color.Gray
                        )
                        Text(
                            appVersion,
                            color = CubeBlue,
                            fontWeight = FontWeight.Bold,
                            fontSize = 12.sp
                        )
                    }
                },
                onClick = {},
                enabled = false,
                leadingIcon = {
                    Icon(
                        Icons.Default.Info,
                        contentDescription = null,
                        tint = CubeBlue
                    )
                }
            )
            HorizontalDivider()
            DropdownMenuItem(
                text = {
                    Column {
                        Text("Update Data", fontWeight = FontWeight.Bold, color = CubeBlue)
                        Text("Download latest data from database", fontSize = 9.sp, color = Color.Gray)
                    }
                },
                enabled = !syncInProgress,
                onClick = {
                    expanded = false
                    onUpdateData()
                },
                leadingIcon = {
                    Icon(Icons.Default.Refresh, contentDescription = null, tint = CubeBlue)
                }
            )
            DropdownMenuItem(
                text = {
                    Column {
                        Text("Sync Now", fontWeight = FontWeight.Bold, color = CubeGreen)
                        Text("Upload and sync with database", fontSize = 9.sp, color = Color.Gray)
                    }
                },
                enabled = !syncInProgress,
                onClick = {
                    expanded = false
                    onSyncNow()
                },
                leadingIcon = {
                    Icon(Icons.Default.Sync, contentDescription = null, tint = CubeGreen)
                }
            )
            HorizontalDivider()
            DropdownMenuItem(
                text = {
                    Text(
                        "Log Out",
                        fontWeight = FontWeight.Bold,
                        color = Color(0xFFD84315)
                    )
                },
                onClick = {
                    expanded = false
                    onLogout()
                },
                leadingIcon = {
                    Icon(
                        Icons.Default.Logout,
                        contentDescription = null,
                        tint = Color(0xFFD84315)
                    )
                }
            )
        }
    }
}

@Composable
private fun DrawerMenuItem(label: String, icon: ImageVector, action: () -> Unit) {
    NavigationDrawerItem(
        label = { Text(label, fontWeight = FontWeight.Bold) },
        selected = false,
        onClick = action,
        icon = { Icon(icon, null, tint = CubeBlue) },
        colors = NavigationDrawerItemDefaults.colors(
            unselectedContainerColor = Color.Transparent,
            unselectedTextColor = CubeText
        ),
        modifier = Modifier.padding(horizontal = 10.dp, vertical = 2.dp)
    )
}

@Composable
private fun RowScope.BottomItem(label: String, icon: ImageVector, selected: Boolean, action: () -> Unit) {
    NavigationBarItem(
        selected = selected,
        onClick = action,
        icon = { Icon(icon, null) },
        label = { Text(label, fontSize = 11.sp) },
        colors = NavigationBarItemDefaults.colors(
            selectedIconColor = Color.White,
            selectedTextColor = CubeOrange,
            indicatorColor = CubeOrange,
            unselectedIconColor = CubeBlue,
            unselectedTextColor = CubeText
        )
    )
}

data class DashboardRange(val start: Long, val end: Long, val label: String)

private fun monthRange(year: Int, month: Int): DashboardRange {
    val start = Calendar.getInstance().apply {
        clear()
        set(year, month, 1, 0, 0, 0)
    }
    val end = Calendar.getInstance().apply {
        clear()
        set(year, month, 1, 0, 0, 0)
        add(Calendar.MONTH, 1)
        add(Calendar.MILLISECOND, -1)
    }
    val label = SimpleDateFormat("MMM yyyy", Locale.US).format(Date(start.timeInMillis))
    return DashboardRange(start.timeInMillis, end.timeInMillis, label)
}

private fun endOfDay(value: Long): Long = Calendar.getInstance().apply {
    timeInMillis = value
    set(Calendar.HOUR_OF_DAY, 23)
    set(Calendar.MINUTE, 59)
    set(Calendar.SECOND, 59)
    set(Calendar.MILLISECOND, 999)
}.timeInMillis

private fun shortDate(value: Long): String =
    SimpleDateFormat("dd MMM yyyy", Locale.US).format(Date(value))

private fun filterTrips(trips: List<Trip>, range: DashboardRange): List<Trip> =
    trips.filter { it.createdAt in range.start..range.end }

@Composable
private fun CubeDashboard(
    store: Store,
    range: DashboardRange,
    monthYear: Pair<Int, Int>,
    customMode: Boolean,
    customStart: Long?,
    customEnd: Long?,
    onMonthChange: (Int, Int) -> Unit,
    onCustomModeChange: (Boolean) -> Unit,
    onCustomStart: (Long) -> Unit,
    onCustomEnd: (Long) -> Unit,
    onBreakdown: (String) -> Unit,
    role: RoleDefinition,
    go: (String) -> Unit
) {
    val trips = filterTrips(store.trips(), range)
    val freight = trips.sumOf { it.freight }
    val expenses = trips.sumOf { it.totalExpenses }
    val margin = trips.sumOf { it.margin }
    val marginPct = if (freight > 0) margin / freight * 100 else 0.0
    var showPeriod by remember { mutableStateOf(false) }

    Column(
        Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(14.dp)
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column {
                Text("Hello, Naveen", fontSize = 19.sp, fontWeight = FontWeight.Black, color = Color(0xFF111111))
                Text("Transport Operations Dashboard", color = CubeBlue, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
            }
            Spacer(Modifier.weight(1f))
            Surface(
                onClick = { showPeriod = true },
                shape = RoundedCornerShape(10.dp),
                border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFD7DFEC)),
                color = Color.White
            ) {
                Row(
                    Modifier.padding(horizontal = 10.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(Icons.Default.CalendarMonth, null, tint = CubeBlue, modifier = Modifier.size(17.dp))
                    Spacer(Modifier.width(5.dp))
                    Text(if (customMode && customStart != null && customEnd != null) {
                        SimpleDateFormat("dd MMM", Locale.US).format(Date(customStart)) + " - " +
                            SimpleDateFormat("dd MMM", Locale.US).format(Date(customEnd))
                    } else range.label, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                    Spacer(Modifier.width(3.dp))
                    Icon(Icons.Default.KeyboardArrowDown, null, modifier = Modifier.size(17.dp))
                }
            }
        }

        if (showPeriod) {
            DashboardPeriodDialog(
                monthYear = monthYear,
                customMode = customMode,
                customStart = customStart,
                customEnd = customEnd,
                onMonthChange = onMonthChange,
                onCustomModeChange = onCustomModeChange,
                onCustomStart = onCustomStart,
                onCustomEnd = onCustomEnd,
                onDismiss = { showPeriod = false }
            )
        }

        Spacer(Modifier.height(12.dp))

        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            KpiCard("Trips", trips.size.toString(), Icons.Default.LocalShipping, CubeLightBlue, CubeBlue, Modifier.weight(1f)) { onBreakdown("Trips") }
            KpiCard("Freight Amount", "₹ " + money0(freight), Icons.Default.Paid, CubeLightGreen, CubeGreen, Modifier.weight(1f)) { onBreakdown("Freight") }
        }
        Spacer(Modifier.height(10.dp))
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            KpiCard("Total Expenses", "₹ " + money0(expenses), Icons.Default.ReceiptLong, CubeLightOrange, Color(0xFFE64A19), Modifier.weight(1f)) { onBreakdown("Expenses") }
            KpiCard("Margin", "₹ " + money0(margin), Icons.Default.BarChart, CubeLightGreen, CubeGreen, Modifier.weight(1f)) { onBreakdown("Margin") }
        }
        Spacer(Modifier.height(10.dp))

        Card(
            onClick = { onBreakdown("Margin %") },
            colors = CardDefaults.cardColors(containerColor = CubeLightGreen),
            shape = RoundedCornerShape(12.dp),
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(Modifier.fillMaxWidth().padding(12.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                Text("Margin %", color = CubeText, fontWeight = FontWeight.SemiBold)
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(String.format(Locale.US, "%.2f%%", marginPct), fontSize = 26.sp, fontWeight = FontWeight.Black)
                    Spacer(Modifier.width(8.dp))
                    Icon(Icons.Default.TrendingUp, null, tint = CubeGreen)
                }
                Text("Tap for breakup", fontSize = 9.sp, color = Color(0xFF64806B))
            }
        }

        Spacer(Modifier.height(12.dp))
        Card(
            onClick = { onBreakdown("Trend") },
            shape = RoundedCornerShape(12.dp),
            colors = CardDefaults.cardColors(containerColor = Color.White),
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(Modifier.padding(12.dp)) {
                Text("Trips Trend", color = CubeBlue, fontWeight = FontWeight.Black, fontSize = 14.sp)
                Text(range.label + " • tap for daily breakup", fontSize = 9.sp, color = Color.Gray)
                Spacer(Modifier.height(10.dp))
                val daily = trips.groupBy {
                    SimpleDateFormat("dd", Locale.US).format(Date(it.createdAt))
                }.mapValues { it.value.size }
                val maxCount = max(1, daily.values.maxOrNull() ?: 1)
                val days = daily.toList().sortedBy { it.first }.takeLast(7)
                Row(
                    Modifier.fillMaxWidth().height(105.dp),
                    horizontalArrangement = Arrangement.SpaceEvenly,
                    verticalAlignment = Alignment.Bottom
                ) {
                    if (days.isEmpty()) {
                        Text("No trips in selected period", fontSize = 11.sp, color = Color.Gray)
                    } else {
                        days.forEach { (day, count) ->
                            Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Bottom) {
                                Box(
                                    Modifier.width(22.dp).height((28 + (count * 58 / maxCount)).dp)
                                        .clip(RoundedCornerShape(topStart = 4.dp, topEnd = 4.dp))
                                        .background(Color(0xFF2D88E8))
                                )
                                Text(day, fontSize = 8.sp)
                            }
                        }
                    }
                }
            }
        }

        Spacer(Modifier.height(12.dp))
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            if (role.canCreateTrips) {
                QuickAction("New Trip", Icons.Default.Add, Modifier.weight(1f)) { go("New Trip") }
            }
            QuickAction("Trip List", Icons.Default.List, Modifier.weight(1f)) { go("Trip List") }
            QuickAction("Reports", Icons.Default.BarChart, Modifier.weight(1f)) { go("Reports") }
            if (role.canManageMasters) {
                QuickAction("Masters", Icons.Default.Settings, Modifier.weight(1f)) { go("Masters") }
            }
        }
        Spacer(Modifier.height(10.dp))
    }
}

@Composable
private fun DashboardPeriodDialog(
    monthYear: Pair<Int, Int>,
    customMode: Boolean,
    customStart: Long?,
    customEnd: Long?,
    onMonthChange: (Int, Int) -> Unit,
    onCustomModeChange: (Boolean) -> Unit,
    onCustomStart: (Long) -> Unit,
    onCustomEnd: (Long) -> Unit,
    onDismiss: () -> Unit
) {
    val context = LocalContext.current

    fun openDate(initial: Long?, onPicked: (Long) -> Unit) {
        val cal = Calendar.getInstance().apply { if (initial != null) timeInMillis = initial }
        DatePickerDialog(
            context,
            { _, y, m, d ->
                val picked = Calendar.getInstance().apply {
                    clear()
                    set(y, m, d, 0, 0, 0)
                }.timeInMillis
                onPicked(picked)
            },
            cal.get(Calendar.YEAR),
            cal.get(Calendar.MONTH),
            cal.get(Calendar.DAY_OF_MONTH)
        ).show()
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Select Dashboard Period", color = CubeBlue, fontWeight = FontWeight.Black) },
        text = {
            Column {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    FilterChip(
                        selected = !customMode,
                        onClick = { onCustomModeChange(false) },
                        label = { Text("Month") }
                    )
                    FilterChip(
                        selected = customMode,
                        onClick = { onCustomModeChange(true) },
                        label = { Text("Custom Date") }
                    )
                }
                Spacer(Modifier.height(12.dp))
                if (!customMode) {
                    val cal = Calendar.getInstance().apply {
                        clear()
                        set(monthYear.first, monthYear.second, 1)
                    }
                    Row(
                        Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        IconButton(onClick = {
                            cal.add(Calendar.MONTH, -1)
                            onMonthChange(cal.get(Calendar.YEAR), cal.get(Calendar.MONTH))
                        }) { Icon(Icons.Default.ChevronLeft, null) }
                        Text(
                            SimpleDateFormat("MMMM yyyy", Locale.US).format(cal.time),
                            fontSize = 17.sp,
                            fontWeight = FontWeight.Black
                        )
                        IconButton(onClick = {
                            cal.add(Calendar.MONTH, 1)
                            onMonthChange(cal.get(Calendar.YEAR), cal.get(Calendar.MONTH))
                        }) { Icon(Icons.Default.ChevronRight, null) }
                    }
                } else {
                    OutlinedButton(onClick = { openDate(customStart, onCustomStart) }, modifier = Modifier.fillMaxWidth()) {
                        Icon(Icons.Default.CalendarMonth, null)
                        Spacer(Modifier.width(8.dp))
                        Text("From: " + (customStart?.let(::shortDate) ?: "Select date"))
                    }
                    Spacer(Modifier.height(8.dp))
                    OutlinedButton(onClick = { openDate(customEnd, onCustomEnd) }, modifier = Modifier.fillMaxWidth()) {
                        Icon(Icons.Default.CalendarMonth, null)
                        Spacer(Modifier.width(8.dp))
                        Text("To: " + (customEnd?.let(::shortDate) ?: "Select date"))
                    }
                }
            }
        },
        confirmButton = {
            Button(
                onClick = onDismiss,
                colors = ButtonDefaults.buttonColors(containerColor = CubeOrange)
            ) { Text("Apply") }
        }
    )
}

@Composable
private fun KpiCard(
    title: String,
    value: String,
    icon: ImageVector,
    bg: Color,
    accent: Color,
    modifier: Modifier = Modifier,
    onClick: () -> Unit
) {
    Card(
        onClick = onClick,
        modifier = modifier.height(92.dp),
        colors = CardDefaults.cardColors(containerColor = bg),
        shape = RoundedCornerShape(12.dp)
    ) {
        Column(Modifier.padding(12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(icon, null, tint = accent)
                Spacer(Modifier.width(6.dp))
                Text(title, fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Color(0xFF111111))
            }
            Spacer(Modifier.height(8.dp))
            Text(value, fontSize = 18.sp, fontWeight = FontWeight.Black, color = Color.Black)
            Text("Tap for breakup", fontSize = 8.sp, color = accent.copy(alpha = .75f))
        }
    }
}

@Composable
private fun DashboardBreakdownScreen(store: Store, range: DashboardRange, kind: String) {
    val trips = filterTrips(store.trips(), range).sortedByDescending { it.createdAt }
    val freight = trips.sumOf { it.freight }
    val expenses = trips.sumOf { it.totalExpenses }
    val margin = trips.sumOf { it.margin }
    val marginPct = if (freight > 0) margin / freight * 100 else 0.0

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(12.dp)) {
        Surface(
            color = CubeLightBlue,
            shape = RoundedCornerShape(10.dp),
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(Modifier.padding(12.dp)) {
                Text(kind + " Breakdown", color = CubeBlue, fontWeight = FontWeight.Black, fontSize = 18.sp)
                Text(
                    shortDate(range.start) + " - " + shortDate(range.end),
                    fontSize = 11.sp,
                    color = Color(0xFF555555)
                )
            }
        }
        Spacer(Modifier.height(10.dp))

        when (kind) {
            "Expenses" -> {
                val percentage = trips.sumOf { it.percentageExpenses }
                val fuel = trips.sumOf { it.fuelExpense }
                val fastag = trips.sumOf { it.fastag }
                val rto = trips.sumOf { it.rtoTarpaulin }
                val loading = trips.sumOf { it.loadingUnloading }
                val fixed = trips.sumOf { it.fixedExpenses }
                BreakdownTotal("Total Expenses", expenses, CubeLightOrange)
                ExpenseBreakRow("Fuel Expense", fuel)
                ExpenseBreakRow("Percentage Expenses", percentage)
                ExpenseBreakRow("FASTag", fastag)
                ExpenseBreakRow("RTO / Tarpaulin", rto)
                ExpenseBreakRow("Loading & Unloading", loading)
                ExpenseBreakRow("Fixed Expenses", fixed)
            }
            "Trend" -> {
                val fmtDay = SimpleDateFormat("dd MMM yyyy", Locale.US)
                val grouped = trips.groupBy { fmtDay.format(Date(it.createdAt)) }
                    .toSortedMap(compareBy { fmtDay.parse(it)?.time ?: 0L })
                BreakdownTotal("Trips", trips.size.toDouble(), CubeLightBlue, money = false)
                grouped.forEach { (date, rows) ->
                    BreakdownRow(date, rows.size.toString(), "₹" + money0(rows.sumOf { it.freight }))
                }
            }
            else -> {
                val totalValue = when (kind) {
                    "Trips" -> trips.size.toDouble()
                    "Freight" -> freight
                    "Margin" -> margin
                    "Margin %" -> marginPct
                    else -> 0.0
                }
                BreakdownTotal(
                    title = kind,
                    value = totalValue,
                    color = if (kind == "Margin" || kind == "Margin %") CubeLightGreen else CubeLightBlue,
                    money = kind == "Freight" || kind == "Margin",
                    percent = kind == "Margin %"
                )
                trips.forEach { t ->
                    val primary = when (kind) {
                        "Trips" -> t.vehicle + " • " + t.from + " → " + t.to
                        "Freight" -> "₹" + money0(t.freight)
                        "Margin" -> "₹" + money0(t.margin)
                        "Margin %" -> String.format(Locale.US, "%.2f%%", t.marginPercent)
                        else -> ""
                    }
                    val secondary = when (kind) {
                        "Trips" -> t.vendor
                        "Freight" -> t.vehicle + " • " + t.vendor
                        "Margin" -> "Freight ₹" + money0(t.freight) + " • Expenses ₹" + money0(t.totalExpenses)
                        "Margin %" -> t.vehicle + " • Margin ₹" + money0(t.margin)
                        else -> ""
                    }
                    BreakdownRow(
                        shortDate(t.createdAt) + " • " + t.vehicle,
                        primary,
                        secondary
                    )
                }
            }
        }

        if (trips.isEmpty()) {
            Card(colors = CardDefaults.cardColors(containerColor = Color.White), modifier = Modifier.fillMaxWidth()) {
                Text("No trip data for the selected period.", Modifier.padding(18.dp), color = Color.Gray)
            }
        }
        Spacer(Modifier.height(24.dp))
    }
}

@Composable
private fun BreakdownTotal(title: String, value: Double, color: Color, money: Boolean = true, percent: Boolean = false) {
    Card(colors = CardDefaults.cardColors(containerColor = color), modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(12.dp)) {
        Column(Modifier.padding(14.dp)) {
            Text(title, color = CubeText, fontWeight = FontWeight.Bold)
            Text(
                when {
                    percent -> String.format(Locale.US, "%.2f%%", value)
                    money -> "₹ " + money0(value)
                    else -> value.toInt().toString()
                },
                fontSize = 24.sp,
                fontWeight = FontWeight.Black
            )
        }
    }
    Spacer(Modifier.height(10.dp))
}

@Composable
private fun ExpenseBreakRow(label: String, amount: Double) {
    BreakdownRow(label, "₹ " + money0(amount), "")
}

@Composable
private fun BreakdownRow(title: String, value: String, subtitle: String) {
    OutlinedCard(
        modifier = Modifier.fillMaxWidth().padding(bottom = 8.dp),
        shape = RoundedCornerShape(10.dp),
        colors = CardDefaults.outlinedCardColors(containerColor = Color.White)
    ) {
        Column(Modifier.padding(12.dp)) {
            Text(title, color = CubeBlue, fontWeight = FontWeight.Bold, fontSize = 12.sp)
            Text(value, fontWeight = FontWeight.Black, fontSize = 16.sp)
            if (subtitle.isNotBlank()) Text(subtitle, fontSize = 10.sp, color = Color.Gray)
        }
    }
}

@Composable
private fun QuickAction(label: String, icon: ImageVector, modifier: Modifier = Modifier, action: () -> Unit) {
    OutlinedCard(
        onClick = action,
        modifier = modifier.height(74.dp),
        shape = RoundedCornerShape(10.dp),
        colors = CardDefaults.outlinedCardColors(containerColor = Color.White)
    ) {
        Column(Modifier.fillMaxSize(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
            Icon(icon, null, tint = if (label == "New Trip") CubeOrange else CubeBlue)
            Spacer(Modifier.height(4.dp))
            Text(label, fontSize = 10.sp, fontWeight = FontWeight.Bold, color = CubeText)
        }
    }
}

fun String.num(): Double = toDoubleOrNull() ?: 0.0
fun fmt(v: Double): String = String.format(java.util.Locale.US, "%.2f", v)
fun money0(v: Double): String = String.format(java.util.Locale("en", "IN"), "%,.0f", v)
