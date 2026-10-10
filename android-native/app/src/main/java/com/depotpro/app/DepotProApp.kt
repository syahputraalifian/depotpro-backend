package com.depotpro.app

import android.app.Application
import android.content.Context
import com.depotpro.app.data.api.ApiClient
import com.depotpro.app.data.repository.AuthRepository
import com.depotpro.app.data.repository.DepotRepository
import com.depotpro.app.data.repository.TokenManager

/** Satu instance per proses, sehingga data & sesi bertahan saat layar diputar/Activity dibuat ulang. */
class AppContainer(context: Context) {
    val tokenManager = TokenManager(context)
    val apiService = ApiClient.create(tokenManager)
    val authRepository = AuthRepository(apiService, tokenManager)
    val depotRepository = DepotRepository(apiService)
}

class DepotProApp : Application() {
    val container: AppContainer by lazy { AppContainer(applicationContext) }
}
