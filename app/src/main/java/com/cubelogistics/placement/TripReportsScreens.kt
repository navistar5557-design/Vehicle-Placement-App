package com.cubelogistics.placement

import android.content.Intent
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@Composable
fun TripListScreen(store: Store) {
    var trips by remember { mutableStateOf(store.trips()) }
    Column(
        Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp)
    ) {
        if (trips.isEmpty()) Text("No trips created.")
        trips.sortedByDescending { it.createdAt }.forEach { t ->
            Card(Modifier.fillMaxWidth().padding(bottom = 8.dp)) {
                Column(Modifier.padding(12.dp)) {
                    Text(t.vehicle + " • " + t.from + " → " + t.to, fontWeight = FontWeight.Bold)
                    Text(day(t.createdAt) + " " + clock(t.createdAt) + " • " + t.vendor)
                    Text("Freight ₹" + fmt(t.freight) + " • Expenses ₹" + fmt(t.totalExpenses))
                    Text("Margin ₹" + fmt(t.margin) + " • " + t.bookingType)
                    TextButton(onClick = {
                        trips = trips.filterNot { it.id == t.id }.toMutableList()
                        store.saveTrips(trips)
                    }) { Text("Delete") }
                }
            }
        }
    }
}

@Composable
fun ReportsScreen(store: Store) {
    val ctx = LocalContext.current
    val all = store.trips()
    var vehicle by remember { mutableStateOf("All") }
    val shown = if (vehicle == "All") all else all.filter { it.vehicle == vehicle }

    Column(
        Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp)
    ) {
        PickField("Vehicle", listOf("All") + store.vehicles().map { it.number }, vehicle) { vehicle = it }
        Spacer(Modifier.height(8.dp))
        Text("Trips: " + shown.size)
        Text("Freight: ₹" + fmt(shown.sumOf { it.freight }))
        Text("Expenses: ₹" + fmt(shown.sumOf { it.totalExpenses }))
        Text("Margin: ₹" + fmt(shown.sumOf { it.margin }), fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(12.dp))

        Button(
            onClick = {
                val csv = reportCsv(shown)
                val intent = Intent(Intent.ACTION_SEND).apply {
                    type = "text/csv"
                    putExtra(Intent.EXTRA_SUBJECT, "CUBE Vehicle Placement Report")
                    putExtra(Intent.EXTRA_TEXT, csv)
                }
                ctx.startActivity(Intent.createChooser(intent, "Export / Share Report"))
            },
            modifier = Modifier.fillMaxWidth()
        ) {
            Text("Export / Share CSV")
        }

        Spacer(Modifier.height(12.dp))
        shown.sortedByDescending { it.createdAt }.forEach {
            Text(day(it.createdAt) + " • " + it.vehicle + " • " + it.from + " → " + it.to + " • ₹" + fmt(it.margin))
        }
    }
}

fun reportCsv(trips: List<Trip>): String = buildString {
    appendLine("Date,Time,Vendor,Vehicle,Current Location,From,To,Booking Type,Freight,Net Freight,Advance,Balance,Weight Ton,Trip KM,Fuel Expense,Total Expenses,Margin")
    trips.forEach { t ->
        val row = listOf(
            day(t.createdAt), clock(t.createdAt), t.vendor, t.vehicle,
            t.currentLocation, t.from, t.to, t.bookingType,
            t.freight.toString(), t.netFreight.toString(), t.advance.toString(),
            t.balance.toString(), t.weightTon.toString(), t.totalKm.toString(),
            t.fuelExpense.toString(), t.totalExpenses.toString(), t.margin.toString()
        )
        appendLine(row.joinToString(",") { csvCell(it) })
    }
}

fun csvCell(value: String): String {
    val quote = 34.toChar()
    val escaped = value.replace(quote.toString(), quote.toString() + quote)
    return if (escaped.contains(',') || escaped.contains(quote) || escaped.contains('\n')) {
        quote + escaped + quote
    } else {
        escaped
    }
}

fun day(value: Long): String =
    SimpleDateFormat("dd-MM-yyyy", Locale.US).format(Date(value))

fun clock(value: Long): String =
    SimpleDateFormat("HH:mm", Locale.US).format(Date(value))
