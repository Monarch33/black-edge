import NextAuth, { NextAuthOptions } from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import CredentialsProvider from "next-auth/providers/credentials"

const providers: NextAuthOptions["providers"] = []

// Only register Google provider if credentials are configured
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    })
  )
}

providers.push(
  // Credentials provider for wallet authentication
  CredentialsProvider({
      name: "Wallet",
      credentials: {
        address: { label: "Wallet Address", type: "text" },
        signature: { label: "Signature", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.address) return null

        // In production, verify the signature here
        // For now, we'll trust the wallet address
        return {
          id: credentials.address,
          name: credentials.address,
          email: null,
        }
      },
    })
)

const authOptions: NextAuthOptions = {
  providers,
  callbacks: {
    async signIn({ user, account }) {
      // Create Black Edge user and API key when signing in
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/credits/admin/create-user`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: user.email,
              google_id: account?.provider === "google" ? account.providerAccountId : null,
              wallet_address: account?.provider === "credentials" ? user.id : null,
              tier: "free",
            }),
          }
        )

        const data = await response.json()

        // Store API key in user object (will be saved to session)
        if (data.api_key) {
          user.apiKey = data.api_key
        }

        return true
      } catch (error) {
        console.error("Failed to create Black Edge user:", error)
        return true // Still allow sign in even if Black Edge user creation fails
      }
    },
    async jwt({ token, user }) {
      // Add API key to JWT token
      if (user?.apiKey) {
        token.apiKey = user.apiKey
      }
      return token
    },
    async session({ session, token }) {
      // Add API key to session
      if (token.apiKey) {
        session.user.apiKey = token.apiKey as string
      }
      return session
    },
  },
  pages: {
    signIn: "/", // Redirect to home page for sign in
  },
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET,
}

const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }
