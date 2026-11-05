package com.cubelogistics.placement

import android.app.DatePickerDialog
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
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlin.math.max
import kotlinx.coroutines.launch

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
    MaterialTheme(
        typography = CubeTypography,
        colorScheme = lightColorScheme(
            primary = CubeBlue,
            secondary = CubeOrange,
            background = CubeBg,
            surface = Color.White
        )
    ) {
        var loggedIn by remember { mutableStateOf(false) }
        if (!loggedIn) CubeLoginScreen { loggedIn = true } else CubeMainShell(store)
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
        val blue = Color(0xFF2367B2)
        val dark = Color(0xFF0E4B8F)
        val light = Color(0xFFDDEBFA)

        // trailer
        drawRoundRect(
            color = Color.White,
            topLeft = androidx.compose.ui.geometry.Offset(w * .08f, h * .20f),
            size = androidx.compose.ui.geometry.Size(w * .56f, h * .42f),
            cornerRadius = androidx.compose.ui.geometry.CornerRadius(5f, 5f)
        )
        drawRect(
            color = light,
            topLeft = androidx.compose.ui.geometry.Offset(w * .10f, h * .23f),
            size = androidx.compose.ui.geometry.Size(w * .52f, h * .05f)
        )
        drawLine(
            color = blue,
            start = androidx.compose.ui.geometry.Offset(w * .10f, h * .60f),
            end = androidx.compose.ui.geometry.Offset(w * .64f, h * .60f),
            strokeWidth = 3f
        )

        // cab
        val cab = Path().apply {
            moveTo(w * .63f, h * .28f)
            lineTo(w * .79f, h * .28f)
            lineTo(w * .90f, h * .46f)
            lineTo(w * .90f, h * .62f)
            lineTo(w * .63f, h * .62f)
            close()
        }
        drawPath(cab, blue)
        drawRect(
            color = Color.White,
            topLeft = androidx.compose.ui.geometry.Offset(w * .68f, h * .33f),
            size = androidx.compose.ui.geometry.Size(w * .11f, h * .12f)
        )
        drawRect(
            color = dark,
            topLeft = androidx.compose.ui.geometry.Offset(w * .81f, h * .34f),
            size = androidx.compose.ui.geometry.Size(w * .07f, h * .10f)
        )

        // wheels
        drawCircle(dark, radius = h * .085f, center = androidx.compose.ui.geometry.Offset(w * .25f, h * .66f))
        drawCircle(dark, radius = h * .085f, center = androidx.compose.ui.geometry.Offset(w * .73f, h * .66f))
        drawCircle(Color.White, radius = h * .035f, center = androidx.compose.ui.geometry.Offset(w * .25f, h * .66f))
        drawCircle(Color.White, radius = h * .035f, center = androidx.compose.ui.geometry.Offset(w * .73f, h * .66f))

        // road / motion lines
        drawLine(
            color = Color(0xFF7DB1E6),
            start = androidx.compose.ui.geometry.Offset(w * .04f, h * .80f),
            end = androidx.compose.ui.geometry.Offset(w * .62f, h * .68f),
            strokeWidth = 3f
        )
        drawLine(
            color = Color(0xFFB2D0EF),
            start = androidx.compose.ui.geometry.Offset(w * .00f, h * .92f),
            end = androidx.compose.ui.geometry.Offset(w * .70f, h * .74f),
            strokeWidth = 2f
        )
    }
}

@Composable
private fun CubeLoginScreen(onLogin: () -> Unit) {
    var user by remember { mutableStateOf("") }
    var pass by remember { mutableStateOf("") }
    var rememberMe by remember { mutableStateOf(true) }

    Box(Modifier.fillMaxSize().background(Color.White)) {
        Canvas(Modifier.fillMaxSize()) {
            // Top blue band
            val topBlue = Path().apply {
                moveTo(0f, 0f)
                lineTo(size.width, 0f)
                lineTo(size.width, size.height * .075f)
                cubicTo(
                    size.width * .74f, size.height * .060f,
                    size.width * .33f, size.height * .072f,
                    0f, size.height * .185f
                )
                close()
            }
            drawPath(topBlue, Color(0xFF124783))

            // Thin white separator
            val topWhite = Path().apply {
                moveTo(0f, size.height * .178f)
                cubicTo(
                    size.width * .32f, size.height * .069f,
                    size.width * .74f, size.height * .055f,
                    size.width, size.height * .070f
                )
                lineTo(size.width, size.height * .080f)
                cubicTo(
                    size.width * .74f, size.height * .064f,
                    size.width * .32f, size.height * .079f,
                    0f, size.height * .190f
                )
                close()
            }
            drawPath(topWhite, Color.White)

            // Orange accent
            val topOrange = Path().apply {
                moveTo(0f, size.height * .165f)
                cubicTo(
                    size.width * .32f, size.height * .060f,
                    size.width * .74f, size.height * .046f,
                    size.width, size.height * .064f
                )
                lineTo(size.width, size.height * .076f)
                cubicTo(
                    size.width * .74f, size.height * .058f,
                    size.width * .32f, size.height * .072f,
                    0f, size.height * .180f
                )
                close()
            }
            drawPath(topOrange, CubeOrange)

            // Bottom blue sweep
            val bottomBlue = Path().apply {
                moveTo(0f, size.height * .905f)
                cubicTo(
                    size.width * .28f, size.height * .815f,
                    size.width * .67f, size.height * .915f,
                    size.width, size.height * .760f
                )
                lineTo(size.width, size.height)
                lineTo(0f, size.height)
                close()
            }
            drawPath(bottomBlue, Color(0xFF124783))

            // Bottom orange sweep
            val bottomOrange = Path().apply {
                moveTo(0f, size.height * .890f)
                cubicTo(
                    size.width * .28f, size.height * .805f,
                    size.width * .67f, size.height * .900f,
                    size.width, size.height * .748f
                )
                lineTo(size.width, size.height * .764f)
                cubicTo(
                    size.width * .67f, size.height * .920f,
                    size.width * .28f, size.height * .825f,
                    0f, size.height * .918f
                )
                close()
            }
            drawPath(bottomOrange, CubeOrange)
        }

        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 34.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Spacer(Modifier.height(132.dp))

            MockupLoginLogo()

            Spacer(Modifier.height(26.dp))
            Text(
                "Transport Operations",
                color = Color(0xFF102A63),
                fontWeight = FontWeight.Black,
                fontSize = 18.sp
            )

            Spacer(Modifier.height(22.dp))

            OutlinedTextField(
                value = user,
                onValueChange = { user = it },
                placeholder = { Text("User ID", fontSize = 14.sp, color = Color(0xFF404040)) },
                leadingIcon = {
                    Icon(
                        Icons.Default.PersonOutline,
                        contentDescription = null,
                        tint = Color(0xFF123F82),
                        modifier = Modifier.size(22.dp)
                    )
                },
                singleLine = true,
                shape = RoundedCornerShape(8.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = Color(0xFFABC2E3),
                    unfocusedBorderColor = Color(0xFFABC2E3),
                    cursorColor = CubeBlue
                ),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(54.dp)
            )

            Spacer(Modifier.height(10.dp))

            OutlinedTextField(
                value = pass,
                onValueChange = { pass = it },
                placeholder = { Text("Password", fontSize = 14.sp, color = Color(0xFF404040)) },
                leadingIcon = {
                    Icon(
                        Icons.Default.Lock,
                        contentDescription = null,
                        tint = Color(0xFF123F82),
                        modifier = Modifier.size(22.dp)
                    )
                },
                trailingIcon = {
                    Icon(
                        Icons.Default.Visibility,
                        contentDescription = null,
                        tint = Color(0xFF123F82),
                        modifier = Modifier.size(20.dp)
                    )
                },
                visualTransformation = PasswordVisualTransformation(),
                singleLine = true,
                shape = RoundedCornerShape(8.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = Color(0xFFABC2E3),
                    unfocusedBorderColor = Color(0xFFABC2E3),
                    cursorColor = CubeBlue
                ),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(54.dp)
            )

            Spacer(Modifier.height(7.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Checkbox(
                    checked = rememberMe,
                    onCheckedChange = { rememberMe = it },
                    colors = CheckboxDefaults.colors(
                        checkedColor = Color(0xFF17488B),
                        uncheckedColor = Color(0xFF17488B),
                        checkmarkColor = Color.White
                    ),
                    modifier = Modifier.size(32.dp)
                )
                Text(
                    "Remember Me",
                    color = Color(0xFF111111),
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Medium
                )
                Spacer(Modifier.weight(1f))
                Text(
                    "Forgot Password?",
                    color = Color(0xFF0A56AE),
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Medium
                )
            }

            Spacer(Modifier.height(21.dp))

            Button(
                onClick = onLogin,
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFFF5C00)),
                shape = RoundedCornerShape(10.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(51.dp)
            ) {
                Spacer(Modifier.weight(.8f))
                Text(
                    "Login",
                    fontWeight = FontWeight.Bold,
                    fontSize = 17.sp
                )
                Spacer(Modifier.width(20.dp))
                Icon(
                    Icons.Default.ArrowForward,
                    contentDescription = null,
                    modifier = Modifier.size(23.dp)
                )
                Spacer(Modifier.weight(.55f))
            }

            Spacer(Modifier.weight(1f))

            MockupTruckIllustration(
                modifier = Modifier
                    .width(205.dp)
                    .height(92.dp)
                    .align(Alignment.Start)
            )

            Spacer(Modifier.height(48.dp))
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun CubeMainShell(store: Store) {
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
                    }
                }
                Spacer(Modifier.height(10.dp))
                DrawerMenuItem("Home", Icons.Default.Home) {
                    page = "Home"
                    scope.launch { drawerState.close() }
                }
                DrawerMenuItem("New Trip", Icons.Default.AddCircleOutline) {
                    page = "New Trip"
                    scope.launch { drawerState.close() }
                }
                DrawerMenuItem("Trip List", Icons.Default.LocalShipping) {
                    page = "Trip List"
                    scope.launch { drawerState.close() }
                }
                DrawerMenuItem("Reports", Icons.Default.BarChart) {
                    page = "Reports"
                    scope.launch { drawerState.close() }
                }
                DrawerMenuItem("Masters", Icons.Default.Settings) {
                    page = "Masters"
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
                        if (page == "Home") IconButton(onClick = {}) {
                            Icon(Icons.Default.Notifications, null, tint = Color.White)
                        }
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
                    BottomItem("New Trip", Icons.Default.AddCircleOutline, page == "New Trip") { page = "New Trip" }
                    BottomItem("Masters", Icons.Default.Settings, page == "Masters") { page = "Masters" }
                }
            }
        ) { pad ->
            Box(Modifier.padding(pad)) {
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
                        go = { page = it }
                    )
                    "Dashboard Breakdown" -> DashboardBreakdownScreen(store, range, breakdown)
                    "New Trip" -> StyledTripEntryScreen(store) { page = "Trip List" }
                    "Trip List" -> StyledTripListScreen(store)
                    "Reports" -> StyledReportsHome(store) { page = it }
                    "Vehicle-wise Report" -> StyledVehicleReport(store)
                    "Masters" -> StyledMastersScreen(store)
                }
            }
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
            QuickAction("New Trip", Icons.Default.Add, Modifier.weight(1f)) { go("New Trip") }
            QuickAction("Trip List", Icons.Default.List, Modifier.weight(1f)) { go("Trip List") }
            QuickAction("Reports", Icons.Default.BarChart, Modifier.weight(1f)) { go("Reports") }
            QuickAction("Masters", Icons.Default.Settings, Modifier.weight(1f)) { go("Masters") }
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
