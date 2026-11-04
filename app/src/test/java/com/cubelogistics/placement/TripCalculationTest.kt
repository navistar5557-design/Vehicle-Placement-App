package com.cubelogistics.placement

import org.junit.Assert.assertEquals
import org.junit.Test

class TripCalculationTest {
 private fun trip(
  freight: Double = 105000.0,
  netFreight: Double = freight,
  advance: Double = 94500.0,
  km: Double = 1000.0,
  mileage: Double = 4.0,
  fuelRate: Double = 100.0,
  rules: List<ExpenseRule> = listOf(ExpenseRule("Commission", 2.0))
 ) = Trip(
  id = "1", createdAt = 0, vendor = "Vendor", vehicle = "TN01AA0001",
  currentLocation = "Erode", from = "Erode", to = "Chennai",
  freight = freight, netFreight = netFreight, advance = advance, weightTon = 10.0,
  currentToOriginKm = 0.0, totalKm = km, transitHours = 12.0,
  mileage = mileage, fuelRate = fuelRate, fixedExpenses = 1000.0,
  fastag = 2000.0, rtoTarpaulin = 500.0, loadingUnloading = 500.0,
  expenseRules = rules
 )

 @Test fun bookingType90Percent() = assertEquals("90% Advance", trip().bookingType)
 @Test fun bookingTypeToPay() = assertEquals("To Pay at Unloading", trip(advance = 0.0).bookingType)
 @Test fun balance() = assertEquals(10500.0, trip().balance, 0.01)
 @Test fun perTon() = assertEquals(10500.0, trip().perTonRate, 0.01)
 @Test fun perKm() = assertEquals(105.0, trip().perKmFreight, 0.01)
 @Test fun percentageExpense() = assertEquals(2100.0, trip().percentageExpenses, 0.01)
 @Test fun fuelExpense() = assertEquals(25000.0, trip().fuelExpense, 0.01)
 @Test fun totalExpense() = assertEquals(31100.0, trip().totalExpenses, 0.01)
 @Test fun marginUsesNetFreight() = assertEquals(71400.0, trip(netFreight = 102500.0).margin, 0.01)
 @Test fun marginDefaultsToFreightWhenEqual() = assertEquals(73900.0, trip().margin, 0.01)
 @Test fun zeroKmSafe() = assertEquals(0.0, trip(km = 0.0).perKmFreight, 0.01)
 @Test fun zeroMileageSafe() = assertEquals(0.0, trip(mileage = 0.0).fuelExpense, 0.01)
}