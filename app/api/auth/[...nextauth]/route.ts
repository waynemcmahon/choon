import NextAuth from "next-auth";
import SpotifyProvider from "next-auth/providers/spotify";

const handler = NextAuth({
  providers: [
    SpotifyProvider({
      clientId: process.env.SPOTIFY_CLIENT_ID!,
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET!,
      authorization: {
        params: {
          scope:
            "user-read-email playlist-read-private user-read-private user-library-read streaming",
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      console.log("JWT callback triggered");
      if (account) {
        console.log("Account received:", account);
        token.accessToken = account.access_token;
      }
      return token;
    },
    async session({ session, token }) {
      console.log("Session callback triggered");
      session.accessToken = token.accessToken;
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    error: "/auth/error", // Error page to redirect to
  },
  debug: true, // Enable NextAuth debug mode
});

// Export NextAuth handler for GET and POST
export { handler as GET, handler as POST };
