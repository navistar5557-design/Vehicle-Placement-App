package com.cubelogistics.placement

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import java.util.UUID

val CubeBlue = Color(0xFF073B7A)
val CubeOrange = Color(0xFFFF6500)

@Composable
fun CubeApp(store: Store) {
    MaterialTheme(colorScheme = lightColorScheme(primary = CubeBlue, secondary = CubeOrange)) {
        var logged by remember { mutableStateOf(false) }
        if (!logged) Login { logged = true } else MainShell(store)
    }
}

@Composable
fun Login(go: () -> Unit) {
    var user by remember { mutableStateOf("") }
    var pass by remember { mutableStateOf("") }
    Column(
        Modifier.fillMaxSize().padding(28.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text("CUBE", style = MaterialTheme.typography.displayLarge, color = CubeBlue, fontWeight = FontWeight.Black)
        Text("LOGISTICS", style = MaterialTheme.typography.headlineSmall, color = CubeOrange, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(24.dp))
        OutlinedTextField(user, { user = it }, label = { Text("User ID") }, modifier = Modifier.fillMaxWidth())
        Spacer(Modifier.height(8.dp))
        OutlinedTextField(pass, { pass = it }, label = { Text("Password") }, modifier = Modifier.fillMaxWidth())
        Spacer(Modifier.height(16.dp))
        Button(go, Modifier.fillMaxWidth()) { Text("Login") }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MainShell(store: Store) {
    var page by remember { mutableStateOf("Dashboard") }
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(if (page == "Dashboard") "CUBE LOGISTICS" else page) },
                navigationIcon = {
                    if (page != "Dashboard") {
                        TextButton(onClick = { page = "Dashboard" }) { Text("Back", color = Color.White) }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = CubeBlue,
                    titleContentColor = Color.White
                )
            )
        }
    ) { pad ->
        Box(Modifier.padding(pad)) {
            when (page) {
                "Dashboard" -> DashboardScreen(store) { page = it }
                "Masters" -> MastersScreen(store)
                "New Trip" -> TripEntryInline(store) { page = "Trip List" }
                "Trip List" -> TripListInline(store)
                "Reports" -> ReportsInline(store)
            }
        }
    }
}

@Composable
fun DashboardScreen(store: Store, go: (String) -> Unit) {
    val trips = store.trips()
    Column(Modifier.fillMaxSize().padding(16.dp)) {
        Text("Vehicle Placement Dashboard", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold, color = CubeBlue)
        Spacer(Modifier.height(12.dp))
        Text("Trips: " + trips.size)
        Text("Freight: ₹" + fmt(trips.sumOf { it.freight }) + "   Margin: ₹" + fmt(trips.sumOf { it.margin }))
        Spacer(Modifier.height(16.dp))
        listOf("New Trip", "Trip List", "Reports", "Masters").forEach { p ->
            Button({ go(p) }, Modifier.fillMaxWidth()) { Text(p) }
            Spacer(Modifier.height(8.dp))
        }
    }
}

@Composable
fun TripEntryInline(store: Store, done: () -> Unit) {
    val vehicles = remember { store.vehicles().filter { it.active } }
    val vendors = remember { store.vendors().filter { it.active } }
    val locations = remember { store.locations().filter { it.active } }

    var vendor by remember { mutableStateOf(vendors.firstOrNull()?.name ?: "") }
    var vehicle by remember { mutableStateOf(vehicles.firstOrNull()?.number ?: "") }
    var from by remember { mutableStateOf(locations.firstOrNull()?.name ?: "") }
    var to by remember { mutableStateOf(locations.getOrNull(1)?.name ?: "") }
    var freight by remember { mutableStateOf("") }
    var netFreight by remember { mutableStateOf("") }
    var advance by remember { mutableStateOf("") }
    var weight by remember { mutableStateOf("") }
    var km by remember { mutableStateOf("") }
    var message by remember { mutableStateOf("") }

    val mileage = vehicles.find { it.number == vehicle }?.mileage ?: 0.0
    val freightValue = freight.num()
    val advanceValue = advance.num()
    val booking = if (advanceValue <= 0) "To Pay at Unloading"
    else if (freightValue > 0) ((advanceValue / freightValue) * 100).toInt().toString() + "% Advance"
    else "-"

    Column(
        Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp)
    ) {
        SimplePicker("Vendor", vendors.map { it.name }, vendor) { vendor = it }
        SimplePicker("Vehicle", vehicles.map { it.number }, vehicle) { vehicle = it }
        SimplePicker("From", locations.map { it.name }, from) { from = it }
        SimplePicker("To", locations.map { it.name }, to) { to = it }

        SimpleNumberField("Freight Amount", freight) { freight = it }
        SimpleNumberField("Net Freight Amount", netFreight) { netFreight = it }
        SimpleNumberField("Advance Amount", advance) { advance = it }
        Text("Booking Type: $booking")
        Text("Balance: ₹" + fmt(freightValue - advanceValue))
        SimpleNumberField("Weight Ton", weight) { weight = it }
        SimpleNumberField("Trip Total KM", km) { km = it }

        val fuelExpense = if (mileage > 0) (km.num() / mileage) * store.fuelRate else 0.0
        Text("Mileage: $mileage km/L")
        Text("Fuel Rate: ₹" + fmt(store.fuelRate))
        Text("Fuel Expense: ₹" + fmt(fuelExpense))

        if (message.isNotBlank()) Text(message, color = MaterialTheme.colorScheme.error)

        Button(
            onClick = {
                if (vendor.isBlank() || vehicle.isBlank() || freightValue <= 0) {
                    message = "Vendor, vehicle and freight are required"
                } else {
                    val trip = Trip(
                        id = UUID.randomUUID().toString(),
                        createdAt = System.currentTimeMillis(),
                        vendor = vendor,
                        vehicle = vehicle,
                        currentLocation = from,
                        from = from,
                        to = to,
                        freight = freightValue,
                        netFreight = if (netFreight.num() > 0) netFreight.num() else freightValue,
                        advance = advanceValue,
                        weightTon = weight.num(),
                        currentToOriginKm = 0.0,
                        totalKm = km.num(),
                        transitHours = 0.0,
                        mileage = mileage,
                        fuelRate = store.fuelRate,
                        fixedExpenses = 0.0,
                        fastag = 0.0,
                        rtoTarpaulin = 0.0,
                        loadingUnloading = 0.0,
                        expenseRules = emptyList()
                    )
                    val all = store.trips()
                    all.add(trip)
                    store.saveTrips(all)
                    done()
                }
            },
            modifier = Modifier.fillMaxWidth()
        ) { Text("Save Trip") }
    }
}

@Composable
fun TripListInline(store: Store) {
    var trips by remember { mutableStateOf(store.trips()) }
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp)) {
        if (trips.isEmpty()) Text("No trips created.")
        trips.sortedByDescending { it.createdAt }.forEach { trip ->
            Card(Modifier.fillMaxWidth().padding(bottom = 8.dp)) {
                Column(Modifier.padding(12.dp)) {
                    Text(trip.vehicle + " • " + trip.from + " → " + trip.to, fontWeight = FontWeight.Bold)
                    Text(trip.vendor + " • " + trip.bookingType)
                    Text("Freight ₹" + fmt(trip.freight) + " • Margin ₹" + fmt(trip.margin))
                    TextButton(onClick = {
                        trips = trips.filterNot { it.id == trip.id }.toMutableList()
                        store.saveTrips(trips)
                    }) { Text("Delete") }
                }
            }
        }
    }
}

@Composable
fun ReportsInline(store: Store) {
    val trips = store.trips()
    var vehicle by remember { mutableStateOf("All") }
    val filtered = if (vehicle == "All") trips else trips.filter { it.vehicle == vehicle }

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp)) {
        SimplePicker("Vehicle", listOf("All") + store.vehicles().map { it.number }, vehicle) { vehicle = it }
        Spacer(Modifier.height(12.dp))
        Text("Trips: " + filtered.size)
        Text("Freight: ₹" + fmt(filtered.sumOf { it.freight }))
        Text("Expenses: ₹" + fmt(filtered.sumOf { it.totalExpenses }))
        Text("Margin: ₹" + fmt(filtered.sumOf { it.margin }), fontWeight = FontWeight.Bold)
    }
}

@Composable
fun SimpleNumberField(label: String, value: String, onChange: (String) -> Unit) {
    OutlinedTextField(value, onChange, label = { Text(label) }, modifier = Modifier.fillMaxWidth())
    Spacer(Modifier.height(6.dp))
}

@Composable
fun SimplePicker(label: String, items: List<String>, selected: String, onSelect: (String) -> Unit) {
    var open by remember { mutableStateOf(false) }
    Box {
        OutlinedButton(onClick = { open = true }, modifier = Modifier.fillMaxWidth()) {
            Text(label + ": " + selected)
        }
        DropdownMenu(expanded = open, onDismissRequest = { open = false }) {
            items.forEach { item ->
                DropdownMenuItem(
                    text = { Text(item) },
                    onClick = {
                        onSelect(item)
                        open = false
                    }
                )
            }
        }
    }
}

fun String.num(): Double = toDoubleOrNull() ?: 0.0
fun fmt(v: Double): String = String.format(java.util.Locale.US, "%.2f", v)
