package com.cubelogistics.placement

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
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlin.math.max

val CubeBlue = Color(0xFF073B7A)
val CubeBlue2 = Color(0xFF0D4E9B)
val CubeOrange = Color(0xFFFF6500)
val CubeLightBlue = Color(0xFFEAF3FF)
val CubeGreen = Color(0xFF139B47)
val CubeLightGreen = Color(0xFFE7F8EA)
val CubeLightOrange = Color(0xFFFFF0E6)
val CubeBg = Color(0xFFF7F9FD)
val CubeText = Color(0xFF102A56)

@Composable
fun CubeApp(store: Store) {
    MaterialTheme(
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
    Row(verticalAlignment = Alignment.CenterVertically) {
        Column(horizontalAlignment = Alignment.End) {
            Text(
                "CUBE",
                color = if (large) CubeBlue else Color.White,
                fontWeight = FontWeight.Black,
                fontSize = if (large) 44.sp else 24.sp,
                letterSpacing = (-1).sp
            )
            Text(
                "LOGISTICS",
                color = CubeOrange,
                fontWeight = FontWeight.Black,
                fontSize = if (large) 19.sp else 9.sp
            )
        }
        Spacer(Modifier.width(if (large) 8.dp else 4.dp))
        Box(
            modifier = Modifier
                .size(if (large) 54.dp else 28.dp)
                .clip(RoundedCornerShape(50))
                .background(if (large) CubeBlue else Color.White),
            contentAlignment = Alignment.Center
        ) {
            Box(
                modifier = Modifier
                    .size(if (large) 28.dp else 15.dp)
                    .background(CubeOrange, RoundedCornerShape(2.dp))
            )
        }
    }
}

@Composable
private fun CubeLoginScreen(onLogin: () -> Unit) {
    var user by remember { mutableStateOf("") }
    var pass by remember { mutableStateOf("") }
    var rememberMe by remember { mutableStateOf(true) }

    Box(Modifier.fillMaxSize().background(Color.White)) {
        Canvas(Modifier.fillMaxSize()) {
            val top = Path().apply {
                moveTo(0f, 0f)
                lineTo(size.width, 0f)
                lineTo(size.width, size.height * .13f)
                cubicTo(size.width * .72f, size.height * .09f, size.width * .30f, size.height * .08f, 0f, size.height * .20f)
                close()
            }
            drawPath(top, CubeBlue)
            val topOrange = Path().apply {
                moveTo(0f, size.height * .18f)
                cubicTo(size.width * .28f, size.height * .09f, size.width * .72f, size.height * .09f, size.width, size.height * .13f)
                lineTo(size.width, size.height * .145f)
                cubicTo(size.width * .72f, size.height * .105f, size.width * .28f, size.height * .105f, 0f, size.height * .205f)
                close()
            }
            drawPath(topOrange, CubeOrange)

            val bottom = Path().apply {
                moveTo(0f, size.height * .86f)
                cubicTo(size.width * .35f, size.height * .78f, size.width * .72f, size.height * .92f, size.width, size.height * .78f)
                lineTo(size.width, size.height)
                lineTo(0f, size.height)
                close()
            }
            drawPath(bottom, CubeBlue)
            val bottomOrange = Path().apply {
                moveTo(0f, size.height * .84f)
                cubicTo(size.width * .35f, size.height * .77f, size.width * .72f, size.height * .90f, size.width, size.height * .77f)
                lineTo(size.width, size.height * .79f)
                cubicTo(size.width * .72f, size.height * .93f, size.width * .35f, size.height * .80f, 0f, size.height * .88f)
                close()
            }
            drawPath(bottomOrange, CubeOrange)
        }

        Column(
            Modifier.fillMaxSize().padding(horizontal = 28.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Spacer(Modifier.height(115.dp))
            CubeBrandLogo(large = true)
            Text("Transport Operations", color = CubeText, fontWeight = FontWeight.Bold, fontSize = 20.sp)
            Spacer(Modifier.height(28.dp))

            OutlinedTextField(
                value = user,
                onValueChange = { user = it },
                leadingIcon = { Icon(Icons.Default.Person, null, tint = CubeBlue) },
                label = { Text("User ID") },
                singleLine = true,
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier.fillMaxWidth()
            )
            Spacer(Modifier.height(10.dp))
            OutlinedTextField(
                value = pass,
                onValueChange = { pass = it },
                leadingIcon = { Icon(Icons.Default.Lock, null, tint = CubeBlue) },
                label = { Text("Password") },
                visualTransformation = PasswordVisualTransformation(),
                singleLine = true,
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier.fillMaxWidth()
            )
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Checkbox(rememberMe, { rememberMe = it })
                Text("Remember Me", fontSize = 13.sp)
                Spacer(Modifier.weight(1f))
                Text("Forgot Password?", color = CubeBlue, fontSize = 13.sp)
            }
            Spacer(Modifier.height(12.dp))
            Button(
                onClick = onLogin,
                colors = ButtonDefaults.buttonColors(containerColor = CubeOrange),
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier.fillMaxWidth().height(54.dp)
            ) {
                Text("Login", fontWeight = FontWeight.Bold, fontSize = 17.sp)
                Spacer(Modifier.width(12.dp))
                Icon(Icons.Default.ArrowForward, null)
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun CubeMainShell(store: Store) {
    var page by remember { mutableStateOf("Home") }

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
                        IconButton(onClick = {}) { Icon(Icons.Default.Menu, null, tint = Color.White) }
                    }
                },
                actions = {
                    if (page == "Home") IconButton(onClick = {}) { Icon(Icons.Default.Notifications, null, tint = Color.White) }
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
                BottomItem("Reports", Icons.Default.BarChart, page.startsWith("Reports")) { page = "Reports" }
                BottomItem("Masters", Icons.Default.Settings, page == "Masters") { page = "Masters" }
            }
        }
    ) { pad ->
        Box(Modifier.padding(pad)) {
            when (page) {
                "Home" -> CubeDashboard(store) { page = it }
                "New Trip" -> StyledTripEntryScreen(store) { page = "Trip List" }
                "Trip List" -> StyledTripListScreen(store)
                "Reports" -> StyledReportsHome(store) { page = it }
                "Vehicle-wise Report" -> StyledVehicleReport(store)
                "Masters" -> StyledMastersScreen(store)
            }
        }
    }
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

@Composable
private fun CubeDashboard(store: Store, go: (String) -> Unit) {
    val trips = store.trips()
    val freight = trips.sumOf { it.freight }
    val expenses = trips.sumOf { it.totalExpenses }
    val margin = trips.sumOf { it.margin }
    val marginPct = if (freight > 0) margin / freight * 100 else 0.0

    Column(
        Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(14.dp)
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column {
                Text("Hello, Naveen", fontSize = 20.sp, fontWeight = FontWeight.Bold, color = Color.Black)
                Text("Transport Operations Dashboard", color = CubeBlue, fontSize = 12.sp)
            }
            Spacer(Modifier.weight(1f))
            Surface(shape = RoundedCornerShape(10.dp), border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFD7DFEC)), color = Color.White) {
                Text("Nov 2026  ⌄", Modifier.padding(horizontal = 10.dp, vertical = 8.dp), fontSize = 12.sp)
            }
        }
        Spacer(Modifier.height(12.dp))

        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            KpiCard("Trips", trips.size.toString(), Icons.Default.LocalShipping, CubeLightBlue, CubeBlue, Modifier.weight(1f))
            KpiCard("Freight Amount", "₹ " + money0(freight), Icons.Default.Paid, CubeLightGreen, CubeGreen, Modifier.weight(1f))
        }
        Spacer(Modifier.height(10.dp))
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            KpiCard("Total Expenses", "₹ " + money0(expenses), Icons.Default.ReceiptLong, CubeLightOrange, Color(0xFFE64A19), Modifier.weight(1f))
            KpiCard("Margin", "₹ " + money0(margin), Icons.Default.BarChart, CubeLightGreen, CubeGreen, Modifier.weight(1f))
        }
        Spacer(Modifier.height(10.dp))

        Card(
            colors = CardDefaults.cardColors(containerColor = CubeLightGreen),
            shape = RoundedCornerShape(12.dp),
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(Modifier.fillMaxWidth().padding(12.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                Text("Margin %", color = CubeText, fontWeight = FontWeight.SemiBold)
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(String.format(java.util.Locale.US, "%.2f%%", marginPct), fontSize = 26.sp, fontWeight = FontWeight.Black)
                    Spacer(Modifier.width(8.dp))
                    Icon(Icons.Default.TrendingUp, null, tint = CubeGreen)
                }
            }
        }

        Spacer(Modifier.height(12.dp))
        Card(
            shape = RoundedCornerShape(12.dp),
            colors = CardDefaults.cardColors(containerColor = Color.White),
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(Modifier.padding(12.dp)) {
                Text("Trips Trend (Last 7 Days)", color = CubeBlue, fontWeight = FontWeight.Bold)
                Spacer(Modifier.height(10.dp))
                Row(
                    Modifier.fillMaxWidth().height(105.dp),
                    horizontalArrangement = Arrangement.SpaceEvenly,
                    verticalAlignment = Alignment.Bottom
                ) {
                    val bars = listOf(3, 4, 5, 6, 4, 6, max(8, trips.size.coerceAtMost(10)))
                    bars.forEachIndexed { index, value ->
                        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Bottom) {
                            Box(
                                Modifier.width(22.dp).height((value * 8).dp)
                                    .clip(RoundedCornerShape(topStart = 4.dp, topEnd = 4.dp))
                                    .background(Color(0xFF2D88E8))
                            )
                            Text((24 + index).toString() + " Oct", fontSize = 8.sp)
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
private fun KpiCard(title: String, value: String, icon: ImageVector, bg: Color, accent: Color, modifier: Modifier = Modifier) {
    Card(
        modifier = modifier.height(92.dp),
        colors = CardDefaults.cardColors(containerColor = bg),
        shape = RoundedCornerShape(12.dp)
    ) {
        Column(Modifier.padding(12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(icon, null, tint = accent)
                Spacer(Modifier.width(6.dp))
                Text(title, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
            }
            Spacer(Modifier.height(8.dp))
            Text(value, fontSize = 19.sp, fontWeight = FontWeight.Black, color = Color.Black)
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
            Text(label, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
        }
    }
}

fun String.num(): Double = toDoubleOrNull() ?: 0.0
fun fmt(v: Double): String = String.format(java.util.Locale.US, "%.2f", v)
fun money0(v: Double): String = String.format(java.util.Locale("en", "IN"), "%,.0f", v)
