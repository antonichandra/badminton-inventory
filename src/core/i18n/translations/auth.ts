export const auth = {
  ID: {
    loginTitle: "Selamat Datang",
    loginSubtitle: "Masuk dengan akun Google Anda untuk melanjutkan",
    loginButton: "Masuk dengan Google",
    loginLoading: "Memproses...",
    waitingTitle: "Menunggu Persetujuan Admin",
    waitingSubtitle:
      "Akun Anda telah terdaftar dan sedang menunggu persetujuan dari administrator.",
    waitingEmail: "Email terdaftar",
    waitingHint:
      "Anda akan dapat mengakses sistem setelah admin menyetujui akun Anda.",
    waitingLogout: "Keluar",
    errorAuth: "Gagal masuk. Silakan coba lagi.",
    errorSession: "Sesi tidak valid. Silakan masuk kembali.",
  },
  EN: {
    loginTitle: "Welcome",
    loginSubtitle: "Sign in with your Google account to continue",
    loginButton: "Sign in with Google",
    loginLoading: "Processing...",
    waitingTitle: "Waiting for Admin Approval",
    waitingSubtitle:
      "Your account has been registered and is awaiting administrator approval.",
    waitingEmail: "Registered email",
    waitingHint:
      "You will be able to access the system once an admin approves your account.",
    waitingLogout: "Sign Out",
    errorAuth: "Sign in failed. Please try again.",
    errorSession: "Invalid session. Please sign in again.",
  },
} as const;
