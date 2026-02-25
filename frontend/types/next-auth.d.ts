import "next-auth"

declare module "next-auth" {
  interface User {
    apiKey?: string
  }

  interface Session {
    user: {
      apiKey?: string
    } & DefaultSession["user"]
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    apiKey?: string
  }
}
