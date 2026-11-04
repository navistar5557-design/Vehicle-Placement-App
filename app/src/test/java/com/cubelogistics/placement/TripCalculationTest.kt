package com.cubelogistics.placement
import org.junit.Assert.*
import org.junit.Test
class TripCalculationTest {
 private fun trip(freight:Double=105000.0,advance:Double=94500.0,km:Double=1000.0,mileage:Double=4.0,fuelRate:Double=100.0,rules:List<ExpenseRule> = listOf(ExpenseRule("Commission",2.0))) =
  Trip("1",0,"Vendor","TN01AA0001","Erode","Erode","Chennai",freight,advance,10.0,km,12.0,mileage,fuelRate,1000.0,2000.0,500.0,500.0,rules)
 @Test fun bookingType90Percent(){ assertEquals("90% Advance",trip().bookingType) }
 @Test fun bookingTypeToPay(){ assertEquals("To Pay at Unloading",trip(advance=0.0).bookingType) }
 @Test fun balance(){ assertEquals(10500.0,trip().balance,0.01) }
 @Test fun perTon(){ assertEquals(10500.0,trip().perTonRate,0.01) }
 @Test fun perKm(){ assertEquals(105.0,trip().perKmFreight,0.01) }
 @Test fun percentageExpense(){ assertEquals(2100.0,trip().percentageExpenses,0.01) }
 @Test fun fuelExpense(){ assertEquals(25000.0,trip().fuelExpense,0.01) }
 @Test fun totalExpense(){ assertEquals(31100.0,trip().totalExpenses,0.01) }
 @Test fun margin(){ assertEquals(73900.0,trip().margin,0.01) }
 @Test fun zeroKmSafe(){ assertEquals(0.0,trip(km=0.0).perKmFreight,0.01) }
 @Test fun zeroMileageSafe(){ assertEquals(0.0,trip(mileage=0.0).fuelExpense,0.01) }
}