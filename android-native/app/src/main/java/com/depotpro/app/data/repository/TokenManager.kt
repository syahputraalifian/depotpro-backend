package com.depotpro.app.data.repository

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.floatPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

private val Context.dataStore by preferencesDataStore(name = "depotpro_prefs")

class TokenManager(private val context: Context) {

    companion object {
        private val TOKEN_KEY = stringPreferencesKey("access_token")
        private val ROLE_KEY = stringPreferencesKey("user_role")
        private val USER_NAME_KEY = stringPreferencesKey("user_name")
        private val USER_EMAIL_KEY = stringPreferencesKey("user_email")
        private val FONT_SCALE_KEY = floatPreferencesKey("font_scale")
    }

    val tokenFlow: Flow<String?> = context.dataStore.data.map { it[TOKEN_KEY] }
    val roleFlow: Flow<String?> = context.dataStore.data.map { it[ROLE_KEY] }
    val userNameFlow: Flow<String?> = context.dataStore.data.map { it[USER_NAME_KEY] }
    val userEmailFlow: Flow<String?> = context.dataStore.data.map { it[USER_EMAIL_KEY] }

    /** Ukuran huruf aplikasi (0.85 - 1.3). Tidak ikut terhapus saat logout. */
    val fontScaleFlow: Flow<Float> = context.dataStore.data.map { it[FONT_SCALE_KEY] ?: 1.0f }

    suspend fun saveFontScale(scale: Float) {
        context.dataStore.edit { it[FONT_SCALE_KEY] = scale.coerceIn(0.85f, 1.3f) }
    }

    suspend fun saveAuthData(token: String, role: String, name: String?, email: String?) {
        context.dataStore.edit { prefs ->
            prefs[TOKEN_KEY] = token
            prefs[ROLE_KEY] = role.lowercase()
            prefs[USER_NAME_KEY] = name ?: ""
            prefs[USER_EMAIL_KEY] = email ?: ""
        }
    }

    suspend fun saveToken(token: String) {
        context.dataStore.edit { it[TOKEN_KEY] = token }
    }

    suspend fun clearAuthData() {
        context.dataStore.edit { prefs ->
            prefs.remove(TOKEN_KEY)
            prefs.remove(ROLE_KEY)
            prefs.remove(USER_NAME_KEY)
            prefs.remove(USER_EMAIL_KEY)
        }
    }
}
