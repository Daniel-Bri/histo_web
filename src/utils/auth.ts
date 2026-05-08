export interface StoredUser {
  id: number
  username: string
  first_name: string
  last_name: string
  email: string
  groups: string[]
  is_staff?: boolean
  is_superuser?: boolean
}

export function getStoredUser(): StoredUser | null {
  try {
    const raw = localStorage.getItem('user')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function hasRole(...roles: string[]): boolean {
  const user = getStoredUser()
  if (!user) return false
  return roles.some(r => user.groups.includes(r))
}
