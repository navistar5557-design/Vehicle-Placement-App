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
  loadingPerTon: Double = 0.0,
  unloadingPerTon: Double = 0.0,
  rules: List<ExpenseRule> = listOf(ExpenseRule("Commission", 2.0)),
  expenseCalcVersion: Int = 0
 ) = Trip(
  id = "1", createdAt = 0, vendor = "Vendor", vehicle = "TN01AA0001",
  currentLocation = "Erode", from = "Erode", to = "Chennai",
  freight = freight, netFreight = netFreight, advance = advance, weightTon = 10.0,
  currentToOriginKm = 0.0, totalKm = km, transitHours = 12.0,
  mileage = mileage, fuelRate = fuelRate, fixedExpenses = 1000.0,
  fastag = 2000.0, rtoTarpaulin = 500.0, loadingUnloading = 500.0,
  expenseRules = rules,
  loadingExpensePerTon = loadingPerTon,
  unloadingExpensePerTon = unloadingPerTon,
  expenseCalcVersion = expenseCalcVersion
 )

 @Test fun bookingType90Percent() = assertEquals("90% Advance", trip().bookingType)
 @Test fun bookingTypeToPay() = assertEquals("To Pay at Unloading", trip(advance = 0.0).bookingType)
 @Test fun balance() = assertEquals(10500.0, trip().balance, 0.01)
 @Test fun perTon() = assertEquals(10500.0, trip().perTonRate, 0.01)
 @Test fun perKm() = assertEquals(105.0, trip().perKmFreight, 0.01)
 @Test fun percentageExpense() = assertEquals(2100.0, trip().percentageExpenses, 0.01)
 @Test fun fuelExpense() = assertEquals(25000.0, trip().fuelExpense, 0.01)
 @Test fun totalExpense() = assertEquals(31100.0, trip().totalExpenses, 0.01)
 @Test fun marginUsesFreightAfterNetFreightRemoval() = assertEquals(73900.0, trip(netFreight = 102500.0).margin, 0.01)
 @Test fun marginFromFreight() = assertEquals(73900.0, trip().margin, 0.01)
 @Test fun loadingExpensePerTon() = assertEquals(1000.0, trip(loadingPerTon = 100.0).loadingExpense, 0.01)
 @Test fun unloadingExpensePerTon() = assertEquals(500.0, trip(unloadingPerTon = 50.0).unloadingExpense, 0.01)
 @Test fun perTonExpensesReduceMargin() = assertEquals(72400.0, trip(loadingPerTon = 100.0, unloadingPerTon = 50.0).margin, 0.01)
 @Test fun legacyLargeHandlingValuesAreTreatedAsTotals() {
  val t = trip(freight = 64500.0, loadingPerTon = 45000.0, unloadingPerTon = 0.0)
  assertEquals(45000.0, t.loadingExpense, 0.01)
  assertEquals(0.0, t.unloadingExpense, 0.01)
  assertEquals(true, t.legacyHandlingCorrected)
 }
 @Test fun version2KeepsPerTonBehavior() {
  val t = trip(freight = 64500.0, loadingPerTon = 500.0, unloadingPerTon = 250.0, expenseCalcVersion = 2)
  assertEquals(5000.0, t.loadingExpense, 0.01)
  assertEquals(2500.0, t.unloadingExpense, 0.01)
 }
 @Test fun version3UsesTotalHandlingAmounts() {
  val t = trip(freight = 64500.0, loadingPerTon = 45000.0, unloadingPerTon = 5000.0, expenseCalcVersion = 3)
  assertEquals(45000.0, t.loadingExpense, 0.01)
  assertEquals(5000.0, t.unloadingExpense, 0.01)
  assertEquals(50000.0, t.loadingExpense + t.unloadingExpense, 0.01)
 }
 @Test fun legacyNumericFieldsAreNormalizedOnce() {
  val legacy = trip(freight = 64500.0, expenseCalcVersion = 3).copy(
   totalKm = 45000.0,
   currentToOriginKm = 12500.0,
   transitHours = 2400.0,
   fastag = 4500000.0,
   rtoTarpaulin = 2500000.0,
   fixedExpenses = 1500000.0,
   loadingExpensePerTon = 4500000.0,
   unloadingExpensePerTon = 500000.0,
   expenseRules = listOf(ExpenseRule("Other Expense", 500.0)),
   numericDataVersion = 0
  )
  val fixed = legacy.normalizedNumericData()
  assertEquals(450.0, fixed.totalKm, 0.01)
  assertEquals(125.0, fixed.currentToOriginKm, 0.01)
  assertEquals(24.0, fixed.transitHours, 0.01)
  assertEquals(45000.0, fixed.fastag, 0.01)
  assertEquals(25000.0, fixed.rtoTarpaulin, 0.01)
  assertEquals(15000.0, fixed.fixedExpenses, 0.01)
  assertEquals(45000.0, fixed.loadingExpensePerTon, 0.01)
  assertEquals(5000.0, fixed.unloadingExpensePerTon, 0.01)
  assertEquals(5.0, fixed.expenseRules.first().percent, 0.01)
  assertEquals(2, fixed.numericDataVersion)
 }
 @Test fun numericNormalizationDoesNotChangeNormalValues() {
  val current = trip(freight = 64500.0, expenseCalcVersion = 3).copy(
   totalKm = 450.0,
   currentToOriginKm = 125.0,
   transitHours = 24.0,
   fastag = 45000.0,
   rtoTarpaulin = 2500.0,
   fixedExpenses = 1500.0,
   loadingExpensePerTon = 45000.0,
   unloadingExpensePerTon = 5000.0,
   expenseRules = listOf(ExpenseRule("Other Expense", 5.0)),
   numericDataVersion = 2
  )
  assertEquals(current, current.normalizedNumericData())
 }
 @Test fun zeroKmSafe() = assertEquals(0.0, trip(km = 0.0).perKmFreight, 0.01)
 @Test fun zeroMileageSafe() = assertEquals(0.0, trip(mileage = 0.0).fuelExpense, 0.01)
}