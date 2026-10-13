package com.depotpro.app.ui.users

import android.widget.Toast
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import com.depotpro.app.data.model.AccountUser
import com.depotpro.app.data.model.Driver

private val ROLE_OPTIONS = listOf(
    "owner" to "Pemilik",
    "cashier" to "Kasir",
    "warehouse_admin" to "Gudang",
    "driver" to "Driver"
)

private fun roleText(code: String): String = ROLE_OPTIONS.firstOrNull { it.first == code }?.second ?: code

@Composable
fun UsersScreen(usersViewModel: UsersViewModel) {
    val state by usersViewModel.state.collectAsState()
    LaunchedEffect(Unit) { usersViewModel.load() }

    var showAdd by remember { mutableStateOf(false) }
    var editTarget by remember { mutableStateOf<AccountUser?>(null) }
    var resetTarget by remember { mutableStateOf<AccountUser?>(null) }
    var deleteTarget by remember { mutableStateOf<AccountUser?>(null) }

    when (val s = state) {
        is UsersState.Loading -> Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            CircularProgressIndicator()
        }
        is UsersState.Error -> Column(
            modifier = Modifier.fillMaxSize().padding(24.dp),
            verticalArrangement = Arrangement.Center,
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(s.message, color = MaterialTheme.colorScheme.error)
            Button(onClick = { usersViewModel.load() }, modifier = Modifier.padding(top = 12.dp)) { Text("Coba Lagi") }
        }
        is UsersState.Success -> {
            Column(modifier = Modifier.fillMaxSize().padding(horizontal = 16.dp, vertical = 8.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("Kelola Akun", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                    Button(onClick = { showAdd = true }) { Text("Tambah Akun") }
                }
                LazyColumn(
                    modifier = Modifier.weight(1f).fillMaxWidth().padding(top = 8.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    items(s.users, key = { it.id ?: it.email }) { user ->
                        val driverName = s.drivers.firstOrNull { it.id == user.driverId }?.name
                        Card(modifier = Modifier.fillMaxWidth()) {
                            Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(user.name, fontWeight = FontWeight.Bold)
                                        Text(user.email, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                        Text(
                                            roleText(user.role) + if (user.role == "driver") " - " + (driverName ?: "belum terhubung ke data driver") else "",
                                            style = MaterialTheme.typography.bodySmall,
                                            color = if (user.role == "driver" && driverName == null) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.primary
                                        )
                                    }
                                    Switch(
                                        checked = user.active != false,
                                        onCheckedChange = { checked -> user.id?.let { usersViewModel.setActive(it, checked) } }
                                    )
                                }
                                Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                                    TextButton(onClick = { editTarget = user }) { Text("Ubah") }
                                    TextButton(onClick = { resetTarget = user }) { Text("Reset Password") }
                                    TextButton(onClick = { deleteTarget = user }) {
                                        Text("Hapus", color = MaterialTheme.colorScheme.error)
                                    }
                                }
                            }
                        }
                    }
                }
            }

            if (showAdd) {
                AccountFormDialog(
                    title = "Tambah Akun",
                    initial = null,
                    drivers = s.drivers,
                    onDismiss = { showAdd = false },
                    onSubmit = { email, name, password, role, driverId ->
                        showAdd = false
                        usersViewModel.create(email, name, password, role, driverId)
                    }
                )
            }
            editTarget?.let { target ->
                AccountFormDialog(
                    title = "Ubah Akun",
                    initial = target,
                    drivers = s.drivers,
                    onDismiss = { editTarget = null },
                    onSubmit = { _, name, _, role, driverId ->
                        editTarget = null
                        target.id?.let { usersViewModel.update(it, name, role, driverId ?: "") }
                    }
                )
            }
            resetTarget?.let { target ->
                ResetPasswordDialog(
                    name = target.name,
                    onDismiss = { resetTarget = null },
                    onSubmit = { password ->
                        resetTarget = null
                        target.id?.let { usersViewModel.resetPassword(it, password) }
                    }
                )
            }
            deleteTarget?.let { target ->
                AlertDialog(
                    onDismissRequest = { deleteTarget = null },
                    title = { Text("Hapus Akun?") },
                    text = { Text("Akun ${target.name} (${target.email}) akan dihapus permanen.") },
                    confirmButton = {
                        Button(onClick = {
                            deleteTarget = null
                            target.id?.let { usersViewModel.delete(it) }
                        }) { Text("Hapus") }
                    },
                    dismissButton = { TextButton(onClick = { deleteTarget = null }) { Text("Batal") } }
                )
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun AccountFormDialog(
    title: String,
    initial: AccountUser?,
    drivers: List<Driver>,
    onDismiss: () -> Unit,
    onSubmit: (String, String, String, String, String?) -> Unit
) {
    val context = LocalContext.current
    val isNew = initial == null
    var email by remember { mutableStateOf(initial?.email ?: "") }
    var name by remember { mutableStateOf(initial?.name ?: "") }
    var password by remember { mutableStateOf("") }
    var role by remember { mutableStateOf(initial?.role ?: "cashier") }
    var driverId by remember { mutableStateOf(initial?.driverId) }
    var roleMenu by remember { mutableStateOf(false) }
    var driverMenu by remember { mutableStateOf(false) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(title) },
        text = {
            Column(
                modifier = Modifier.verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                OutlinedTextField(
                    value = email,
                    onValueChange = { email = it },
                    label = { Text("Email") },
                    singleLine = true,
                    enabled = isNew,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
                    modifier = Modifier.fillMaxWidth()
                )
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("Nama") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                if (isNew) {
                    OutlinedTextField(
                        value = password,
                        onValueChange = { password = it },
                        label = { Text("Password (min. 6 karakter)") },
                        singleLine = true,
                        visualTransformation = PasswordVisualTransformation(),
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                        modifier = Modifier.fillMaxWidth()
                    )
                }
                ExposedDropdownMenuBox(expanded = roleMenu, onExpandedChange = { roleMenu = !roleMenu }) {
                    OutlinedTextField(
                        value = roleText(role),
                        onValueChange = {},
                        readOnly = true,
                        label = { Text("Peran") },
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = roleMenu) },
                        modifier = Modifier.fillMaxWidth().menuAnchor()
                    )
                    ExposedDropdownMenu(expanded = roleMenu, onDismissRequest = { roleMenu = false }) {
                        ROLE_OPTIONS.forEach { (code, label) ->
                            DropdownMenuItem(
                                text = { Text(label) },
                                onClick = {
                                    role = code
                                    roleMenu = false
                                }
                            )
                        }
                    }
                }
                if (role == "driver") {
                    ExposedDropdownMenuBox(expanded = driverMenu, onExpandedChange = { driverMenu = !driverMenu }) {
                        OutlinedTextField(
                            value = drivers.firstOrNull { it.id == driverId }?.name ?: "Pilih data driver",
                            onValueChange = {},
                            readOnly = true,
                            label = { Text("Hubungkan ke data driver") },
                            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = driverMenu) },
                            modifier = Modifier.fillMaxWidth().menuAnchor()
                        )
                        ExposedDropdownMenu(expanded = driverMenu, onDismissRequest = { driverMenu = false }) {
                            drivers.forEach { d ->
                                DropdownMenuItem(
                                    text = { Text(d.name) },
                                    onClick = {
                                        driverId = d.id
                                        driverMenu = false
                                    }
                                )
                            }
                        }
                    }
                    Text(
                        "Driver hanya melihat tugas dan data miliknya sendiri setelah dihubungkan.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        },
        confirmButton = {
            Button(onClick = {
                when {
                    isNew && !email.contains("@") ->
                        Toast.makeText(context, "Email tidak valid", Toast.LENGTH_SHORT).show()
                    name.isBlank() ->
                        Toast.makeText(context, "Nama wajib diisi", Toast.LENGTH_SHORT).show()
                    isNew && password.length < 6 ->
                        Toast.makeText(context, "Password minimal 6 karakter", Toast.LENGTH_SHORT).show()
                    else -> onSubmit(email, name, password, role, if (role == "driver") driverId else null)
                }
            }) { Text("Simpan") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Batal") } }
    )
}

@Composable
private fun ResetPasswordDialog(name: String, onDismiss: () -> Unit, onSubmit: (String) -> Unit) {
    val context = LocalContext.current
    var password by remember { mutableStateOf("") }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Reset Password") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Password baru untuk $name. Akun ini akan otomatis keluar dari semua perangkat.")
                OutlinedTextField(
                    value = password,
                    onValueChange = { password = it },
                    label = { Text("Password baru (min. 6 karakter)") },
                    singleLine = true,
                    visualTransformation = PasswordVisualTransformation(),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                    modifier = Modifier.fillMaxWidth()
                )
            }
        },
        confirmButton = {
            Button(onClick = {
                if (password.length < 6) {
                    Toast.makeText(context, "Password minimal 6 karakter", Toast.LENGTH_SHORT).show()
                } else {
                    onSubmit(password)
                }
            }) { Text("Simpan") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Batal") } }
    )
}
