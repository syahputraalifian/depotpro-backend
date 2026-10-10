package com.depotpro.app.data.api

import com.depotpro.app.data.repository.TokenManager
import kotlinx.coroutines.flow.firstOrNull
import kotlinx.coroutines.runBlocking
import okhttp3.Interceptor
import okhttp3.Response

class AuthInterceptor(private val tokenManager: TokenManager) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val token = runBlocking { tokenManager.tokenFlow.firstOrNull() }
        val builder = chain.request().newBuilder()
        if (!token.isNullOrEmpty()) {
            builder.header("Authorization", "Bearer $token")
        }
        val response = chain.proceed(builder.build())

        val isLogin = chain.request().url.encodedPath.endsWith("auth/login")
        if (response.code == 401 && !token.isNullOrEmpty() && !isLogin) {
            // Token ditolak server: hapus sesi lokal dan beri tahu UI.
            runBlocking { tokenManager.clearAuthData() }
            SessionEvents.notifyExpired()
        }
        return response
    }
}
