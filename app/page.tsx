"use client"

import { SessionProvider } from "next-auth/react"
import Game from '@/components/Game';

export default function Home() {
  return (
    <SessionProvider>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold text-center mb-8">Choon</h1>
        <Game />
      </div>
    </SessionProvider>
  );
}