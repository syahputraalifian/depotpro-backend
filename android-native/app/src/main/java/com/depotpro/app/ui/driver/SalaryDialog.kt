package com.depotpro.app.ui.driver

import android.widget.Toast
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.depotpro.app.data.model.Driver
import com.depotpro.app.ui.pos.rupiah

private fun plain(value: Double): String =
    if (value % 1.0 == 0.0) value.toLong().toString() else value.toString()

/** Atur gaji pokok, komisi per galon/tabung, uang bensin, dan potongan seorang driver (khusus pemilik). */
@Composable
fun SalaryDialog(
    driver: Driver,
    onDismiss: () -> Unit,
    onSave: (base: Double, gallonRate: Double, lpgRate: Double, fuel: Double, deductions: Double) -> Unit
) {
    val context = LocalContext.current
    var base by remember { mutableStateOf(plain(driver.baseSalary)) }
    var gallonRate by remember { mutableStateOf(plain(driver.gallonCommissionRate)) }
    var lpgRate by remember { mutableStateOf(plain(driver.lpgCommissionRate)) }
    var fuel by remember { mutableStateOf(plain(driver.fuelAllowance)) }
    var deductions by remember { mutableStateOf(plain(driver.deductions)) }

    val baseV = base.toDoubleOrNull()
    val gallonV = gallonRate.toDoubleOrNull()
    val lpgV = lpgRate.toDoubleOrNull()
    val fuelV = fuel.toDoubleOrNull()
    val dedV = deductions.toDoubleOrNull()
    val valid = baseV != null && gallonV != null && lpgV != null && fuelV != null && dedV != null

    // Perkiraan total memakai jumlah pengiriman periode berjalan.
    val preview = if (valid) {
        (baseV ?: 0.0) + driver.gallonsDelivered * (gallonV ?: 0.0) + driver.lpgDelivered * (lpgV ?: 0.0) +
            (fuelV ?: 0.0) - (dedV ?: 0.0)
    } else null

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Atur Gaji - ${driver.name}") },
        text = {
            Column(
                modifier = Modifier.verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                NumberField("Gaji pokok (Rp)", base) { base = it }
                NumberField("Komisi per galon/AMDK (Rp)", gallonRate) { gallonRate = it }
                NumberField("Komisi per tabung LPG (Rp)", lpgRate) { lpgRate = it }
                NumberField("Uang bensin (Rp)", fuel) { fuel = it }
                NumberField("Potongan (Rp)", deductions) { deductions = it }
                if (preview != null) {
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text("Perkiraan diterima", fontWeight = FontWeight.Bold)
                        Text(rupiah(preview.coerceAtLeast(0.0)), fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
                    }
                    Text(
                        "Dihitung dari ${driver.gallonsDelivered} galon dan ${driver.lpgDelivered} tabung yang sudah diantar pada periode ini.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        },
        confirmButton = {
            Button(onClick = {
                if (valid) {
                    onSave(baseV ?: 0.0, gallonV ?: 0.0, lpgV ?: 0.0, fuelV ?: 0.0, dedV ?: 0.0)
                } else {
                    Toast.makeText(context, "Isi semua kolom dengan angka", Toast.LENGTH_SHORT).show()
                }
            }) { Text("Simpan") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Batal") } }
    )
}

@Composable
private fun NumberField(label: String, value: String, onChange: (String) -> Unit) {
    OutlinedTextField(
        value = value,
        onValueChange = { onChange(it.filter { ch -> ch.isDigit() }) },
        label = { Text(label) },
        singleLine = true,
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
        modifier = Modifier.fillMaxWidth()
    )
}
