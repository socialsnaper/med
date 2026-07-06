"use client"

import { useContext } from "react"
import { AuthContext } from "./AuthContext"

/**
 * Access the authentication context.
 * Must be used inside <AuthProvider>.
 */
export function useAuth() {
  return useContext(AuthContext)
}
