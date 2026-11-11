package com.cubelogistics.placement

import android.app.DatePickerDialog
import android.widget.Toast

import android.content.Intent
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import kotlinx.coroutines.launch
import kotlinx.coroutines.delay
import kotlinx.coroutines.coroutineScope
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import java.text.SimpleDateFormat
import java.util.*

@Composable
fun StyledTripEntryScreen(store: Store, createdBy: String = "", createdByEmail: String = "", done: () -> Unit) {
    val vehicles = remember { store.vehicles().filter { it.active } }
    val vendors = remember { store.vendors().filter { it.active } }
    val locations = remember { store.locations().filter { it.active } }

    var vendor by remember { mutableStateOf(vendors.firstOrNull()?.name ?: "") }
    var vehicle by remember { mutableStateOf(vehicles.firstOrNull()?.number ?: "") }
    var current by remember { mutableStateOf(locations.firstOrNull()?.name ?: "") }
    var from by remember { mutableStateOf(locations.firstOrNull()?.name ?: "") }
    var to by remember { mutableStateOf(locations.getOrNull(1)?.name ?: "") }
    var freight by remember { mutableStateOf("") }
    var mileageSelection by remember {
        mutableStateOf(
            vehicles.firstOrNull()?.mileage?.let { String.format(Locale.US, "%.1f", it) } ?: ""
        )
    }
    var advance by remember { mutableStateOf("") }
    var weight by remember { mutableStateOf("") }
    var originKm by remember { mutableStateOf("") }
    var km by remember { mutableStateOf("") }
    var hours by remember { mutableStateOf("") }
    var expensePct by remember { mutableStateOf("") }
    var fastag by remember { mutableStateOf("") }
    var rto by remember { mutableStateOf("") }
    var loadingPerTon by remember { mutableStateOf("") }
    var unloadingPerTon by remember { mutableStateOf("") }
    var fixed by remember { mutableStateOf("") }
    var expensesOpen by remember { mutableStateOf(false) }
    var fuelOpen by remember { mutableStateOf(false) }
    var message by remember { mutableStateOf("") }

    val mileage = mileageSelection.num()
    val f = freight.num()
    val a = advance.num()
    val booking = if (a <= 0) "To Pay at Unloading" else if (f > 0) ((a / f) * 100).toInt().toString() + "% Advance" else "-"
    val fuelExpense = if (mileage > 0) (km.num() / mileage) * store.fuelRate else 0.0
    val percentExpense = f * expensePct.num() / 100.0
    val loadingExpense = loadingPerTon.num() * weight.num()
    val unloadingExpense = unloadingPerTon.num() * weight.num()
    val totalExpense = percentExpense + fuelExpense + fastag.num() + rto.num() + loadingExpense + unloadingExpense + fixed.num()
    val margin = f - totalExpense

    Column(
        Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(12.dp)
    ) {
        SectionHeader(Icons.Default.LocalShipping, "Trip Details")
        StyledPicker("Vendor / Transporter", vendors.map { it.name }, vendor) { vendor = it }
        Spacer(Modifier.height(8.dp))
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Box(Modifier.weight(1f)) {
                StyledPicker("Vehicle No", vehicles.map { it.number }, vehicle) { selected ->
                    vehicle = selected
                    vehicles.find { it.number == selected }?.mileage?.let {
                        mileageSelection = String.format(Locale.US, "%.1f", it)
                    }
                }
            }
            Box(Modifier.weight(.72f)) {
                StyledPicker(
                    "Vehicle Mileage (km/L)",
                    vehicleMileageOptions,
                    mileageSelection
                ) { mileageSelection = it }
            }
        }
        Spacer(Modifier.height(8.dp))
        StyledPicker("Current Location (VHL)", locations.map { it.name }, current) { current = it }
        Spacer(Modifier.height(8.dp))
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Box(Modifier.weight(1f)) { StyledPicker("From", locations.map { it.name }, from) { from = it } }
            Box(Modifier.weight(1f)) { StyledPicker("To", locations.map { it.name }, to) { to = it } }
        }
        Spacer(Modifier.height(8.dp))
        StyledNumberField("Including Expenses Freight Amount (₹)", freight) { freight = it }
        Spacer(Modifier.height(8.dp))
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Box(Modifier.weight(1f)) {
                StyledNumberField("Loading Expense / Ton (₹)", loadingPerTon) { loadingPerTon = it }
            }
            Box(Modifier.weight(1f)) {
                StyledNumberField("Unloading Expense / Ton (₹)", unloadingPerTon) { unloadingPerTon = it }
            }
        }
        if (weight.num() > 0 && (loadingPerTon.num() > 0 || unloadingPerTon.num() > 0)) {
            Spacer(Modifier.height(6.dp))
            Text(
                "Loading ₹" + money0(loadingExpense) + "  •  Unloading ₹" + money0(unloadingExpense) +
                    "  •  Included in Total Expenses",
                fontSize = 10.sp,
                color = CubeBlue,
                fontWeight = FontWeight.SemiBold
            )
        }
        Spacer(Modifier.height(8.dp))
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.weight(1f)) { StyledNumberField("Advance Amount (₹)", advance) { advance = it } }
            Surface(
                modifier = Modifier.weight(.72f),
                color = CubeLightOrange,
                shape = RoundedCornerShape(10.dp),
                border = BorderStroke(1.dp, Color(0xFFFFB37C))
            ) {
                Column(Modifier.padding(10.dp)) {
                    Text("Booking Type", color = CubeBlue, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                    Text(booking, color = CubeOrange, fontSize = 14.sp, fontWeight = FontWeight.Black)
                }
            }
        }
        Spacer(Modifier.height(8.dp))
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Box(Modifier.weight(1f)) { StyledNumberField("Weight (Ton)", weight) { weight = it } }
            Box(Modifier.weight(1f)) { StyledNumberField("Trip Total KM", km) { km = it } }
            Box(Modifier.weight(1f)) { StyledNumberField("In-transit Time (HH)", hours) { hours = it } }
        }
        Spacer(Modifier.height(8.dp))
        StyledNumberField("VHL Current Location to Origin KM", originKm) { originKm = it }

        Spacer(Modifier.height(10.dp))
        ExpandSection(Icons.Default.Percent, "Expenses (% of Freight)", expensesOpen) { expensesOpen = !expensesOpen }
        if (expensesOpen) {
            Spacer(Modifier.height(8.dp))
            StyledNumberField("Other Expense %", expensePct) { expensePct = it }
            Spacer(Modifier.height(6.dp))
            StyledNumberField("FASTag Expense", fastag) { fastag = it }
            Spacer(Modifier.height(6.dp))
            StyledNumberField("RTO / Tarpaulin", rto) { rto = it }
            Spacer(Modifier.height(6.dp))
            StyledNumberField("Fixed Expenses", fixed) { fixed = it }
        }

        Spacer(Modifier.height(8.dp))
        ExpandSection(Icons.Default.LocalGasStation, "Fuel Expense (Mileage Based)", fuelOpen) { fuelOpen = !fuelOpen }
        if (fuelOpen) {
            Surface(
                modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                shape = RoundedCornerShape(10.dp),
                color = CubeLightBlue
            ) {
                Column(Modifier.padding(12.dp)) {
                    Text("Trip KM ÷ Mileage × Fuel Rate", fontSize = 11.sp, color = CubeText)
                    Text("₹ " + money0(fuelExpense), fontSize = 19.sp, fontWeight = FontWeight.Black, color = CubeBlue)
                    Text("Fuel rate ₹" + fmt(store.fuelRate) + "/L", fontSize = 11.sp)
                }
            }
        }

        Spacer(Modifier.height(10.dp))
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            SummaryCard("Total Expenses", "₹ " + money0(totalExpense), CubeLightGreen, Modifier.weight(1f))
            SummaryCard("Margin", "₹ " + money0(margin), CubeLightOrange, Modifier.weight(1f))
        }

        if (message.isNotBlank()) {
            Spacer(Modifier.height(8.dp))
            Text(message, color = MaterialTheme.colorScheme.error, fontWeight = FontWeight.Bold, fontFamily = FontFamily.SansSerif)
        }

        Spacer(Modifier.height(12.dp))
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            OutlinedButton(
                onClick = {
                    freight = ""; advance = ""; weight = ""; originKm = ""; km = ""; hours = ""
                    loadingPerTon = ""; unloadingPerTon = ""
                    expensePct = ""; fastag = ""; rto = ""; fixed = ""; message = ""
                },
                modifier = Modifier.weight(1f).height(50.dp),
                shape = RoundedCornerShape(10.dp)
            ) {
                Icon(Icons.Default.Refresh, null)
                Spacer(Modifier.width(6.dp))
                Text("Clear")
            }
            Button(
                onClick = {
                    if (vendor.isBlank() || vehicle.isBlank() || f <= 0) {
                        message = "Vendor, vehicle and freight are required"
                    } else {
                        val trip = Trip(
                            id = UUID.randomUUID().toString(),
                            createdAt = System.currentTimeMillis(),
                            vendor = vendor,
                            vehicle = vehicle,
                            currentLocation = current,
                            from = from,
                            to = to,
                            freight = f,
                            netFreight = f,
                            advance = a,
                            weightTon = weight.num(),
                            currentToOriginKm = originKm.num(),
                            totalKm = km.num(),
                            transitHours = hours.num(),
                            mileage = mileage,
                            fuelRate = store.fuelRate,
                            fixedExpenses = fixed.num(),
                            fastag = fastag.num(),
                            rtoTarpaulin = rto.num(),
                            loadingUnloading = 0.0,
                            expenseRules = if (expensePct.num() > 0) listOf(ExpenseRule("Other Expense", expensePct.num())) else emptyList(),
                            loadingExpensePerTon = loadingPerTon.num(),
                            unloadingExpensePerTon = unloadingPerTon.num(),
                            createdBy = createdBy,
                            createdByEmail = createdByEmail
                        )
                        val trips = store.trips()
                        trips.add(trip)
                        store.saveTrips(trips)
                        done()
                    }
                },
                modifier = Modifier.weight(1.35f).height(50.dp),
                colors = ButtonDefaults.buttonColors(containerColor = CubeOrange),
                shape = RoundedCornerShape(10.dp)
            ) {
                Icon(Icons.Default.Save, null)
                Spacer(Modifier.width(6.dp))
                Text("Save Trip", fontWeight = FontWeight.Bold)
            }
        }
        Spacer(Modifier.height(24.dp))
    }
}

@Composable
fun StyledTripListScreen(store: Store, canDelete: Boolean = false) {
    var trips by remember { mutableStateOf(store.trips()) }
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(12.dp)) {
        if (trips.isEmpty()) {
            EmptyCard("No trips created yet", "Create a trip from the Home screen.")
        }
        trips.sortedByDescending { it.createdAt }.forEach { t ->
            Card(
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                modifier = Modifier.fillMaxWidth().padding(bottom = 10.dp)
            ) {
                Column(Modifier.padding(14.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Surface(color = CubeLightBlue, shape = RoundedCornerShape(9.dp)) {
                            Icon(Icons.Default.LocalShipping, null, tint = CubeBlue, modifier = Modifier.padding(8.dp))
                        }
                        Spacer(Modifier.width(10.dp))
                        Column(Modifier.weight(1f)) {
                            Text(t.vehicle, color = CubeBlue, fontWeight = FontWeight.Black, fontSize = 15.sp, fontFamily = FontFamily.SansSerif)
                            Text(t.from + "  →  " + t.to, fontWeight = FontWeight.Bold, fontFamily = FontFamily.SansSerif)
                        }
                        Text(styledDay(t.createdAt), fontSize = 11.sp, color = Color.Gray)
                    }
                    Spacer(Modifier.height(10.dp))
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        SmallMetric("Freight", "₹" + money0(t.freight))
                        SmallMetric("Expenses", "₹" + money0(t.totalExpenses))
                        SmallMetric("Margin", "₹" + money0(t.margin))
                    }
                    Spacer(Modifier.height(8.dp))
                    Text(t.vendor + " • " + t.bookingType, color = CubeText, fontSize = 12.sp)
                    val creatorLabel = when {
                        t.createdBy.isNotBlank() -> t.createdBy
                        t.createdByEmail.isNotBlank() -> t.createdByEmail
                        else -> "Legacy entry"
                    }
                    Text(
                        "Created by " + creatorLabel + " • " + styledDateTime(t.createdAt),
                        color = Color.Gray,
                        fontSize = 9.sp,
                        modifier = Modifier.padding(top = 3.dp)
                    )
                    if (canDelete) {
                        TextButton(
                            onClick = {
                                trips = trips.filterNot { it.id == t.id }.toMutableList()
                                store.saveTrips(trips)
                            },
                            modifier = Modifier.align(Alignment.End)
                        ) {
                            Icon(Icons.Default.DeleteOutline, null, tint = Color(0xFFD32F2F))
                            Text("Delete", color = Color(0xFFD32F2F))
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun StyledReportsHome(store: Store, navigate: (String) -> Unit) {
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(12.dp)) {
        ReportOption(Icons.Default.LocalShipping, "Trip Details Report", "All trip placement details with expenses and margin") { navigate("Trip Details Report") }
        ReportOption(Icons.Default.Groups, "Vendor-wise Report", "Trips, freight, expenses & margin (Monthly / Date Range)") { navigate("Vendor-wise Report") }
        ReportOption(Icons.Default.LocalShipping, "Vehicle-wise Report", "Trips, freight, expenses & margin (Monthly / Date Range)") { navigate("Vehicle-wise Report") }
        ReportOption(Icons.Default.Paid, "Expense Summary Report", "Expense head-wise summary (%, amount & total)") { navigate("Expense Summary Report") }
        ReportOption(Icons.Default.BarChart, "Margin / Profitability Report", "Profit, margin % and trip performance") { navigate("Margin / Profitability Report") }
    }
}

@Composable
fun StyledVehicleReport(store: Store) {
    val ctx = LocalContext.current
    val all = store.trips()
    val vehicles = store.vehicles().map { it.number }
    var selectedVehicles by remember { mutableStateOf<Set<String>>(emptySet()) }
    var vehicleMenu by remember { mutableStateOf(false) }
    var vendor by remember { mutableStateOf("All Vendors") }
    var from by remember { mutableStateOf("All Locations") }
    var to by remember { mutableStateOf("All Locations") }
    val vendors = store.vendors().map { it.name }
    val locations = store.locations().map { it.name }
    val initial = remember { currentMonthBounds() }
    var startDate by remember { mutableLongStateOf(initial.first) }
    var endDate by remember { mutableLongStateOf(initial.second) }

    val shown = all.filter {
        it.createdAt in startDate..endDate &&
        (selectedVehicles.isEmpty() || it.vehicle in selectedVehicles) &&
        (vendor == "All Vendors" || it.vendor == vendor) &&
        (from == "All Locations" || it.from == from) &&
        (to == "All Locations" || it.to == to)
    }

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(12.dp)) {
        ReportDateRange(startDate, endDate, { startDate = it }, { endDate = endOfSelectedDay(it) })
        Spacer(Modifier.height(8.dp))

        Box {
            OutlinedButton(
                onClick = { vehicleMenu = true },
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(9.dp)
            ) {
                Column(Modifier.weight(1f), horizontalAlignment = Alignment.Start) {
                    Text("Vehicles (Multi-Select)", fontSize = 10.sp, color = Color.Gray)
                    Text(
                        if (selectedVehicles.isEmpty()) "All Vehicles" else selectedVehicles.joinToString(", "),
                        maxLines = 1,
                        color = Color.Black,
                        fontWeight = FontWeight.SemiBold
                    )
                }
                Icon(Icons.Default.KeyboardArrowDown, null, tint = CubeBlue)
            }
            DropdownMenu(expanded = vehicleMenu, onDismissRequest = { vehicleMenu = false }) {
                DropdownMenuItem(
                    text = { Text("All Vehicles") },
                    leadingIcon = { Checkbox(checked = selectedVehicles.isEmpty(), onCheckedChange = null) },
                    onClick = { selectedVehicles = emptySet() }
                )
                vehicles.forEach { v ->
                    DropdownMenuItem(
                        text = { Text(v) },
                        leadingIcon = { Checkbox(checked = v in selectedVehicles, onCheckedChange = null) },
                        onClick = {
                            selectedVehicles = if (v in selectedVehicles) selectedVehicles - v else selectedVehicles + v
                        }
                    )
                }
            }
        }

        Spacer(Modifier.height(8.dp))
        StyledPicker("Vendor", listOf("All Vendors") + vendors, vendor) { vendor = it }
        Spacer(Modifier.height(8.dp))
        StyledPicker("From Location", listOf("All Locations") + locations, from) { from = it }
        Spacer(Modifier.height(8.dp))
        StyledPicker("To Location", listOf("All Locations") + locations, to) { to = it }

        Spacer(Modifier.height(12.dp))
        Button(
            onClick = { Toast.makeText(ctx, "Report generated", Toast.LENGTH_SHORT).show() },
            modifier = Modifier.fillMaxWidth().height(50.dp),
            colors = ButtonDefaults.buttonColors(containerColor = CubeOrange),
            shape = RoundedCornerShape(10.dp)
        ) {
            Icon(Icons.Default.BarChart, null)
            Spacer(Modifier.width(8.dp))
            Text("Generate Report", fontWeight = FontWeight.Bold)
        }

        Spacer(Modifier.height(12.dp))
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            OutlinedButton(
                onClick = {
                    val csv = styledReportCsv(shown)
                    val intent = Intent(Intent.ACTION_SEND).apply {
                        type = "text/csv"
                        putExtra(Intent.EXTRA_SUBJECT, "CUBE Vehicle-wise Report")
                        putExtra(Intent.EXTRA_TEXT, csv)
                    }
                    ctx.startActivity(Intent.createChooser(intent, "Export Report"))
                },
                modifier = Modifier.weight(1f)
            ) {
                Icon(Icons.Default.TableView, null, tint = CubeGreen)
                Spacer(Modifier.width(6.dp))
                Text("Excel")
            }
            OutlinedButton(
                onClick = {
                    val csv = styledReportCsv(shown)
                    val intent = Intent(Intent.ACTION_SEND).apply {
                        type = "text/csv"
                        putExtra(Intent.EXTRA_SUBJECT, "CUBE Vehicle-wise Report")
                        putExtra(Intent.EXTRA_TEXT, csv)
                    }
                    ctx.startActivity(Intent.createChooser(intent, "Share to Google Sheets"))
                },
                modifier = Modifier.weight(1f)
            ) {
                Icon(Icons.Default.GridOn, null, tint = CubeGreen)
                Spacer(Modifier.width(6.dp))
                Text("Google Sheet")
            }
        }

        Spacer(Modifier.height(14.dp))
        ReportSummaryCards(shown)
        Spacer(Modifier.height(14.dp))

        if (shown.isEmpty()) {
            EmptyCard("No matching trips", "Change the report filters or date range.")
        } else {
            shown.groupBy { it.vehicle }.forEach { (v, rows) ->
                Card(
                    shape = RoundedCornerShape(10.dp),
                    colors = CardDefaults.cardColors(containerColor = Color.White),
                    modifier = Modifier.fillMaxWidth().padding(bottom = 8.dp)
                ) {
                    Column(Modifier.padding(12.dp)) {
                        Text(v, color = CubeBlue, fontWeight = FontWeight.Black)
                        Text("Trips: " + rows.size + "   Total KM: " + money0(rows.sumOf { it.totalKm }), fontSize = 12.sp)
                        Text("Freight ₹" + money0(rows.sumOf { it.freight }) + "   Margin ₹" + money0(rows.sumOf { it.margin }), fontSize = 12.sp)
                    }
                }
            }
        }
        Spacer(Modifier.height(20.dp))
    }
}

@Composable
fun StyledGenericReport(store: Store, type: String) {
    val all = store.trips()
    val initial = remember { currentMonthBounds() }
    var startDate by remember { mutableLongStateOf(initial.first) }
    var endDate by remember { mutableLongStateOf(initial.second) }
    val shown = all.filter { it.createdAt in startDate..endDate }

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(12.dp)) {
        ReportDateRange(startDate, endDate, { startDate = it }, { endDate = endOfSelectedDay(it) })
        Spacer(Modifier.height(12.dp))
        ReportSummaryCards(shown)
        Spacer(Modifier.height(14.dp))

        when (type) {
            "Trip Details Report" -> {
                shown.sortedByDescending { it.createdAt }.forEach { t ->
                    Card(
                        colors = CardDefaults.cardColors(containerColor = Color.White),
                        modifier = Modifier.fillMaxWidth().padding(bottom = 8.dp),
                        shape = RoundedCornerShape(10.dp)
                    ) {
                        Column(Modifier.padding(12.dp)) {
                            Text(t.vehicle + " • " + styledDay(t.createdAt), color = CubeBlue, fontWeight = FontWeight.Black)
                            Text(t.vendor + " • " + t.from + " → " + t.to, fontSize = 11.sp)
                            Text("Freight ₹" + money0(t.freight) + "  Expenses ₹" + money0(t.totalExpenses) + "  Margin ₹" + money0(t.margin), fontSize = 11.sp)
                        }
                    }
                }
            }
            "Vendor-wise Report" -> {
                shown.groupBy { it.vendor }.toSortedMap().forEach { (vendor, rows) ->
                    ReportGroupCard(vendor, rows)
                }
            }
            "Expense Summary Report" -> {
                val fuel = shown.sumOf { it.fuelExpense }
                val percent = shown.sumOf { it.percentageExpenses }
                val fastag = shown.sumOf { it.fastag }
                val rto = shown.sumOf { it.rtoTarpaulin }
                val loading = shown.sumOf { it.loadingExpense }
                val unloading = shown.sumOf { it.unloadingExpense }
                val legacyLoading = shown.sumOf { it.loadingUnloading }
                val fixed = shown.sumOf { it.fixedExpenses }
                ExpenseSummaryRow("Fuel Expense", fuel)
                ExpenseSummaryRow("Percentage Expenses", percent)
                ExpenseSummaryRow("FASTag", fastag)
                ExpenseSummaryRow("RTO / Tarpaulin", rto)
                ExpenseSummaryRow("Loading Expense", loading)
                ExpenseSummaryRow("Unloading Expense", unloading)
                if (legacyLoading > 0) ExpenseSummaryRow("Loading & Unloading (Old Trips)", legacyLoading)
                ExpenseSummaryRow("Fixed Expenses", fixed)
            }
            "Margin / Profitability Report" -> {
                shown.sortedByDescending { it.margin }.forEach { t ->
                    Card(
                        colors = CardDefaults.cardColors(containerColor = Color.White),
                        modifier = Modifier.fillMaxWidth().padding(bottom = 8.dp),
                        shape = RoundedCornerShape(10.dp)
                    ) {
                        Column(Modifier.padding(12.dp)) {
                            Text(t.vehicle + " • " + t.vendor, color = CubeBlue, fontWeight = FontWeight.Black)
                            Text("Margin ₹" + money0(t.margin) + "  •  " + String.format(Locale.US, "%.2f%%", t.marginPercent), color = if (t.margin >= 0) CubeGreen else Color(0xFFD32F2F), fontWeight = FontWeight.Bold)
                            Text("Freight ₹" + money0(t.freight) + "  Expenses ₹" + money0(t.totalExpenses), fontSize = 11.sp)
                        }
                    }
                }
            }
        }

        if (shown.isEmpty()) {
            EmptyCard("No report data", "No trips found for the selected period.")
        }
        Spacer(Modifier.height(20.dp))
    }
}

@Composable
private fun ReportDateRange(
    startDate: Long,
    endDate: Long,
    onStart: (Long) -> Unit,
    onEnd: (Long) -> Unit
) {
    val context = LocalContext.current
    fun pick(initial: Long, picked: (Long) -> Unit) {
        val cal = Calendar.getInstance().apply { timeInMillis = initial }
        DatePickerDialog(
            context,
            { _, y, m, d ->
                val value = Calendar.getInstance().apply {
                    clear()
                    set(y, m, d, 0, 0, 0)
                }.timeInMillis
                picked(value)
            },
            cal.get(Calendar.YEAR),
            cal.get(Calendar.MONTH),
            cal.get(Calendar.DAY_OF_MONTH)
        ).show()
    }

    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        OutlinedButton(onClick = { pick(startDate, onStart) }, modifier = Modifier.weight(1f)) {
            Icon(Icons.Default.CalendarMonth, null, modifier = Modifier.size(16.dp))
            Spacer(Modifier.width(4.dp))
            Text("From " + styledDay(startDate), fontSize = 10.sp)
        }
        OutlinedButton(onClick = { pick(endDate, onEnd) }, modifier = Modifier.weight(1f)) {
            Icon(Icons.Default.CalendarMonth, null, modifier = Modifier.size(16.dp))
            Spacer(Modifier.width(4.dp))
            Text("To " + styledDay(endDate), fontSize = 10.sp)
        }
    }
}

@Composable
private fun ReportSummaryCards(rows: List<Trip>) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        SummaryCard("Trips", rows.size.toString(), CubeLightBlue, Modifier.weight(1f))
        SummaryCard("Freight", "₹" + money0(rows.sumOf { it.freight }), CubeLightGreen, Modifier.weight(1f))
    }
    Spacer(Modifier.height(8.dp))
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        SummaryCard("Expenses", "₹" + money0(rows.sumOf { it.totalExpenses }), CubeLightOrange, Modifier.weight(1f))
        SummaryCard("Margin", "₹" + money0(rows.sumOf { it.margin }), CubeLightGreen, Modifier.weight(1f))
    }
}

@Composable
private fun ReportGroupCard(title: String, rows: List<Trip>) {
    Card(
        colors = CardDefaults.cardColors(containerColor = Color.White),
        modifier = Modifier.fillMaxWidth().padding(bottom = 8.dp),
        shape = RoundedCornerShape(10.dp)
    ) {
        Column(Modifier.padding(12.dp)) {
            Text(title, color = CubeBlue, fontWeight = FontWeight.Black)
            Text("Trips: " + rows.size + "  Freight ₹" + money0(rows.sumOf { it.freight }), fontSize = 11.sp)
            Text("Expenses ₹" + money0(rows.sumOf { it.totalExpenses }) + "  Margin ₹" + money0(rows.sumOf { it.margin }), fontSize = 11.sp)
        }
    }
}

@Composable
private fun ExpenseSummaryRow(label: String, amount: Double) {
    OutlinedCard(
        modifier = Modifier.fillMaxWidth().padding(bottom = 8.dp),
        shape = RoundedCornerShape(10.dp)
    ) {
        Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
            Text(label, Modifier.weight(1f), color = CubeBlue, fontWeight = FontWeight.Bold)
            Text("₹" + money0(amount), fontWeight = FontWeight.Black)
        }
    }
}

private fun currentMonthBounds(): Pair<Long, Long> {
    val start = Calendar.getInstance().apply {
        set(Calendar.DAY_OF_MONTH, 1)
        set(Calendar.HOUR_OF_DAY, 0)
        set(Calendar.MINUTE, 0)
        set(Calendar.SECOND, 0)
        set(Calendar.MILLISECOND, 0)
    }
    val end = (start.clone() as Calendar).apply {
        add(Calendar.MONTH, 1)
        add(Calendar.MILLISECOND, -1)
    }
    return start.timeInMillis to end.timeInMillis
}

private fun endOfSelectedDay(value: Long): Long {
    return Calendar.getInstance().apply {
        timeInMillis = value
        set(Calendar.HOUR_OF_DAY, 23)
        set(Calendar.MINUTE, 59)
        set(Calendar.SECOND, 59)
        set(Calendar.MILLISECOND, 999)
    }.timeInMillis
}

private fun Modifier.holdForTwoSeconds(onHold: () -> Unit): Modifier = pointerInput(onHold) {
    detectTapGestures(
        onPress = {
            coroutineScope {
                var fired = false
                val job = launch {
                    delay(2000)
                    fired = true
                    onHold()
                }
                tryAwaitRelease()
                if (!fired) job.cancel()
            }
        }
    )
}

@Composable
fun StyledMastersScreen(store: Store) {
    var tab by remember { mutableStateOf("Vehicles") }
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(12.dp)) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            listOf("Vehicles", "Vendors", "Locations", "Fuel").forEach { item ->
                FilterChip(
                    selected = tab == item,
                    onClick = { tab = item },
                    label = { Text(item, fontSize = 11.sp) },
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = CubeBlue,
                        selectedLabelColor = Color.White
                    )
                )
            }
        }
        Spacer(Modifier.height(6.dp))
        if (tab != "Fuel") {
            Text(
                "Press and hold an existing " + tab.dropLast(1).lowercase() + " for 2 seconds to edit.",
                fontSize = 10.sp,
                color = Color.Gray
            )
            Spacer(Modifier.height(8.dp))
        }
        when (tab) {
            "Vehicles" -> StyledVehicleMaster(store)
            "Vendors" -> StyledNameMaster("Vendor", store)
            "Locations" -> StyledNameMaster("Location", store)
            "Fuel" -> StyledFuelMaster(store)
        }
    }
}

private val vehicleMileageOptions = (25..60).map { String.format(Locale.US, "%.1f", it / 10.0) }

@Composable
private fun StyledVehicleMaster(store: Store) {
    var items by remember { mutableStateOf(store.vehicles()) }
    var number by remember { mutableStateOf("") }
    var mileage by remember { mutableStateOf("") }
    var message by remember { mutableStateOf("") }
    var editing by remember { mutableStateOf<Vehicle?>(null) }

    SectionHeader(Icons.Default.LocalShipping, "Vehicle Master")
    StyledNumberOrTextField("Vehicle No", number) { number = it.uppercase() }
    Spacer(Modifier.height(8.dp))
    StyledPicker(
        "Vehicle Mileage (km/L)",
        vehicleMileageOptions,
        mileage
    ) { mileage = it }
    Spacer(Modifier.height(8.dp))
    Button(
        onClick = {
            val m = mileage.num()
            message = when {
                number.isBlank() -> "Vehicle number is required"
                m < 2.5 || m > 6.0 -> "Mileage must be between 2.5 and 6.0"
                items.any { it.number.equals(number, true) } -> "Duplicate vehicle number"
                else -> {
                    items = (items + Vehicle(number.trim(), m)).toMutableList()
                    store.saveVehicles(items)
                    number = ""; mileage = ""; "Vehicle saved"
                }
            }
        },
        colors = ButtonDefaults.buttonColors(containerColor = CubeOrange),
        modifier = Modifier.fillMaxWidth()
    ) { Text("Add Vehicle") }
    if (message.isNotBlank()) Text(message, Modifier.padding(vertical = 8.dp), color = CubeBlue)

    items.forEach { v ->
        OutlinedCard(
            modifier = Modifier
                .fillMaxWidth()
                .padding(bottom = 8.dp)
                .holdForTwoSeconds { editing = v },
            shape = RoundedCornerShape(10.dp)
        ) {
            Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Default.LocalShipping, null, tint = CubeBlue)
                Spacer(Modifier.width(10.dp))
                Column(Modifier.weight(1f)) {
                    Text(v.number, fontWeight = FontWeight.Bold)
                    Text(fmt(v.mileage) + " km/L", fontSize = 12.sp)
                }
                TextButton(onClick = {
                    items = items.map { if (it.number == v.number) it.copy(active = !it.active) else it }.toMutableList()
                    store.saveVehicles(items)
                }) {
                    Text(if (v.active) "Deactivate" else "Activate")
                }
            }
        }
    }

    editing?.let { old ->
        var editNumber by remember(old) { mutableStateOf(old.number) }
        var editMileage by remember(old) { mutableStateOf(old.mileage.toString()) }
        var editError by remember(old) { mutableStateOf("") }
        AlertDialog(
            onDismissRequest = { editing = null },
            title = { Text("Edit Vehicle", color = CubeBlue, fontWeight = FontWeight.Black) },
            text = {
                Column {
                    OutlinedTextField(
                        value = editNumber,
                        onValueChange = { editNumber = it.uppercase() },
                        label = { Text("Vehicle No") },
                        singleLine = true
                    )
                    Spacer(Modifier.height(8.dp))
                    StyledPicker(
                        "Vehicle Mileage (km/L)",
                        vehicleMileageOptions,
                        editMileage
                    ) { editMileage = it }
                    if (editError.isNotBlank()) {
                        Spacer(Modifier.height(6.dp))
                        Text(editError, color = MaterialTheme.colorScheme.error, fontSize = 11.sp)
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        val newNo = editNumber.trim()
                        val newMileage = editMileage.num()
                        editError = when {
                            newNo.isBlank() -> "Vehicle number is required"
                            newMileage < 2.5 || newMileage > 6.0 -> "Mileage must be between 2.5 and 6.0"
                            items.any { it.number != old.number && it.number.equals(newNo, true) } -> "Duplicate vehicle number"
                            else -> {
                                store.renameVehicle(old.number, newNo, newMileage)
                                items = store.vehicles()
                                editing = null
                                message = "Vehicle updated"
                                ""
                            }
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = CubeOrange)
                ) { Text("Update") }
            },
            dismissButton = {
                TextButton(onClick = { editing = null }) { Text("Cancel") }
            }
        )
    }
}

@Composable
private fun StyledNameMaster(label: String, store: Store) {
    var items by remember(label) {
        mutableStateOf(if (label == "Vendor") store.vendors().map { it.name } else store.locations().map { it.name })
    }
    var name by remember { mutableStateOf("") }
    var message by remember { mutableStateOf("") }
    var editing by remember { mutableStateOf<String?>(null) }

    fun saveAll(values: List<String>) {
        if (label == "Vendor") store.saveVendors(values.map(::Vendor))
        else store.saveLocations(values.map(::Location))
    }

    SectionHeader(if (label == "Vendor") Icons.Default.Groups else Icons.Default.LocationOn, label + " Master")
    StyledNumberOrTextField(label + " Name", name) { name = it }
    Spacer(Modifier.height(8.dp))
    Button(
        onClick = {
            val n = name.trim()
            if (n.isBlank()) message = label + " name is required"
            else if (items.any { it.equals(n, true) }) message = "Duplicate " + label
            else {
                items = items + n
                saveAll(items)
                name = ""
                message = label + " saved"
            }
        },
        colors = ButtonDefaults.buttonColors(containerColor = CubeOrange),
        modifier = Modifier.fillMaxWidth()
    ) { Text("Add " + label) }

    if (message.isNotBlank()) Text(message, Modifier.padding(vertical = 8.dp), color = CubeBlue)

    items.forEach { item ->
        OutlinedCard(
            modifier = Modifier
                .fillMaxWidth()
                .padding(bottom = 7.dp)
                .holdForTwoSeconds { editing = item },
            shape = RoundedCornerShape(10.dp)
        ) {
            Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                Icon(if (label == "Vendor") Icons.Default.Groups else Icons.Default.LocationOn, null, tint = CubeBlue)
                Spacer(Modifier.width(10.dp))
                Text(item, fontWeight = FontWeight.Bold, fontFamily = FontFamily.SansSerif)
            }
        }
    }

    editing?.let { old ->
        var editName by remember(old) { mutableStateOf(old) }
        var editError by remember(old) { mutableStateOf("") }
        AlertDialog(
            onDismissRequest = { editing = null },
            title = { Text("Edit " + label, color = CubeBlue, fontWeight = FontWeight.Black) },
            text = {
                Column {
                    OutlinedTextField(
                        value = editName,
                        onValueChange = { editName = it },
                        label = { Text(label + " Name") },
                        singleLine = true
                    )
                    if (editError.isNotBlank()) {
                        Spacer(Modifier.height(6.dp))
                        Text(editError, color = MaterialTheme.colorScheme.error, fontSize = 11.sp)
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        val newName = editName.trim()
                        editError = when {
                            newName.isBlank() -> label + " name is required"
                            items.any { it != old && it.equals(newName, true) } -> "Duplicate " + label
                            else -> {
                                if (label == "Vendor") store.renameVendor(old, newName) else store.renameLocation(old, newName)
                                items = if (label == "Vendor") store.vendors().map { it.name } else store.locations().map { it.name }
                                editing = null
                                message = label + " updated"
                                ""
                            }
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = CubeOrange)
                ) { Text("Update") }
            },
            dismissButton = {
                TextButton(onClick = { editing = null }) { Text("Cancel") }
            }
        )
    }
}

@Composable
private fun StyledFuelMaster(store: Store) {
    var rate by remember { mutableStateOf(store.fuelRate.toString()) }
    var message by remember { mutableStateOf("") }
    SectionHeader(Icons.Default.LocalGasStation, "Fuel Rate Master")
    StyledNumberField("Fuel Rate ₹/L", rate) { rate = it }
    Spacer(Modifier.height(8.dp))
    Button(
        onClick = {
            if (rate.num() > 0) {
                store.fuelRate = rate.num()
                message = "Fuel rate saved"
            } else message = "Enter a valid fuel rate"
        },
        colors = ButtonDefaults.buttonColors(containerColor = CubeOrange),
        modifier = Modifier.fillMaxWidth()
    ) { Text("Save Fuel Rate") }
    if (message.isNotBlank()) Text(message, Modifier.padding(vertical = 8.dp), color = CubeBlue)
}

@Composable
private fun SectionHeader(icon: ImageVector, title: String) {
    Surface(
        color = CubeLightBlue,
        shape = RoundedCornerShape(8.dp),
        modifier = Modifier.fillMaxWidth().padding(bottom = 8.dp)
    ) {
        Row(Modifier.padding(horizontal = 10.dp, vertical = 7.dp), verticalAlignment = Alignment.CenterVertically) {
            Icon(icon, null, tint = CubeOrange)
            Spacer(Modifier.width(8.dp))
            Text(title, color = CubeBlue, fontWeight = FontWeight.Black, fontSize = 15.sp)
        }
    }
}

@Composable
private fun ExpandSection(icon: ImageVector, title: String, expanded: Boolean, action: () -> Unit) {
    OutlinedCard(onClick = action, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(9.dp)) {
        Row(Modifier.padding(11.dp), verticalAlignment = Alignment.CenterVertically) {
            Icon(icon, null, tint = CubeOrange)
            Spacer(Modifier.width(8.dp))
            Text(title, Modifier.weight(1f), color = CubeBlue, fontWeight = FontWeight.Bold)
            Icon(if (expanded) Icons.Default.KeyboardArrowUp else Icons.Default.KeyboardArrowDown, null)
        }
    }
}

@Composable
private fun StyledPicker(label: String, items: List<String>, selected: String, onSelect: (String) -> Unit) {
    var open by remember { mutableStateOf(false) }
    Box {
        OutlinedButton(
            onClick = { open = true },
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(9.dp),
            contentPadding = PaddingValues(horizontal = 12.dp, vertical = 10.dp)
        ) {
            Column(Modifier.weight(1f), horizontalAlignment = Alignment.Start) {
                Text(label, fontSize = 10.sp, color = Color(0xFF6A6A6A), fontWeight = FontWeight.SemiBold)
                Text(selected.ifBlank { "Select" }, color = Color.Black, fontWeight = FontWeight.SemiBold, maxLines = 1)
            }
            Icon(Icons.Default.KeyboardArrowDown, null, tint = CubeBlue)
        }
        DropdownMenu(expanded = open, onDismissRequest = { open = false }) {
            items.forEach {
                DropdownMenuItem(
                    text = { Text(it) },
                    onClick = { onSelect(it); open = false }
                )
            }
        }
    }
}

@Composable
private fun StyledNumberField(label: String, value: String, onChange: (String) -> Unit) {
    OutlinedTextField(
        value = value,
        onValueChange = onChange,
        label = { Text(label, fontSize = 11.sp) },
        singleLine = true,
        shape = RoundedCornerShape(9.dp),
        modifier = Modifier.fillMaxWidth()
    )
}

@Composable
private fun StyledNumberOrTextField(label: String, value: String, onChange: (String) -> Unit) {
    OutlinedTextField(
        value = value,
        onValueChange = onChange,
        label = { Text(label) },
        singleLine = true,
        shape = RoundedCornerShape(9.dp),
        modifier = Modifier.fillMaxWidth()
    )
}

@Composable
private fun SummaryCard(title: String, value: String, color: Color, modifier: Modifier = Modifier) {
    Card(modifier = modifier, colors = CardDefaults.cardColors(containerColor = color), shape = RoundedCornerShape(10.dp)) {
        Column(Modifier.fillMaxWidth().padding(12.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Text(title, fontSize = 11.sp, color = CubeText)
            Text(value, fontSize = 17.sp, fontWeight = FontWeight.Black, color = Color(0xFF111111))
        }
    }
}

@Composable
private fun ReportOption(icon: ImageVector, title: String, subtitle: String, action: () -> Unit) {
    OutlinedCard(
        onClick = action,
        shape = RoundedCornerShape(12.dp),
        modifier = Modifier.fillMaxWidth().padding(bottom = 10.dp),
        colors = CardDefaults.outlinedCardColors(containerColor = Color.White)
    ) {
        Row(Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
            Surface(color = CubeLightBlue, shape = RoundedCornerShape(9.dp)) {
                Icon(icon, null, tint = CubeBlue, modifier = Modifier.padding(9.dp))
            }
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(title, color = CubeBlue, fontWeight = FontWeight.Black, fontSize = 15.sp, fontFamily = FontFamily.SansSerif)
                Text(subtitle, fontSize = 11.sp, color = Color(0xFF333333), fontFamily = FontFamily.SansSerif)
            }
            Icon(Icons.Default.ChevronRight, null, tint = CubeBlue)
        }
    }
}

@Composable
private fun StyledTextBox(label: String, value: String, icon: ImageVector) {
    OutlinedCard(Modifier.fillMaxWidth(), shape = RoundedCornerShape(9.dp)) {
        Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
            Icon(icon, null, tint = CubeBlue)
            Spacer(Modifier.width(10.dp))
            Column {
                Text(label, fontSize = 10.sp, color = Color(0xFF6A6A6A), fontWeight = FontWeight.SemiBold)
                Text(value, fontWeight = FontWeight.Bold, fontFamily = FontFamily.SansSerif)
            }
        }
    }
}

@Composable
private fun SmallMetric(title: String, value: String) {
    Column {
        Text(title, fontSize = 10.sp, color = Color(0xFF6A6A6A), fontWeight = FontWeight.SemiBold)
        Text(value, fontSize = 12.sp, fontWeight = FontWeight.Black, color = Color(0xFF111111))
    }
}

@Composable
private fun EmptyCard(title: String, subtitle: String) {
    Card(colors = CardDefaults.cardColors(containerColor = Color.White), modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(12.dp)) {
        Column(Modifier.padding(20.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Icon(Icons.Default.Inbox, null, tint = CubeBlue, modifier = Modifier.size(40.dp))
            Spacer(Modifier.height(8.dp))
            Text(title, fontWeight = FontWeight.Bold)
            Text(subtitle, fontSize = 12.sp, color = Color.Gray)
        }
    }
}

private fun styledDay(value: Long): String = SimpleDateFormat("dd-MM-yyyy", Locale.US).format(Date(value))

private fun styledCsvCell(value: String): String {
    val quote = 34.toChar()
    val escaped = value.replace(quote.toString(), quote.toString() + quote)
    return if (escaped.contains(',') || escaped.contains(quote) || escaped.contains('\n')) quote + escaped + quote else escaped
}

private fun styledReportCsv(trips: List<Trip>): String = buildString {
    appendLine("Date,Vendor,Vehicle,Current Location,From,To,Booking Type,Freight,Net Freight,Advance,Balance,Weight Ton,Trip KM,Fuel Expense,Total Expenses,Margin")
    trips.forEach { t ->
        val row = listOf(
            styledDay(t.createdAt), t.vendor, t.vehicle, t.currentLocation, t.from, t.to, t.bookingType,
            t.freight.toString(), t.netFreight.toString(), t.advance.toString(), t.balance.toString(),
            t.weightTon.toString(), t.totalKm.toString(), t.fuelExpense.toString(), t.totalExpenses.toString(), t.margin.toString()
        )
        appendLine(row.joinToString(",") { styledCsvCell(it) })
    }
}fun styledDateTime(value: Long): String = SimpleDateFormat("dd MMM yyyy, hh:mm a", Locale.US).format(Date(value))

