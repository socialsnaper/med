# Login Flow Debugging

## Issue: After login, redirected back to `/login?from=%2Fdashboard`

### Root Causes Fixed:

1. **Missing Dashboard Route Protection** ✅
   - Created `ProtectedLayout` component that checks authentication before rendering
   - Wraps the entire dashboard layout to enforce auth

2. **Missing Dashboard Index Page** ✅
   - Created `/dashboard/page.tsx` that redirects to `/dashboard/admin`
   - Prevents 404 when accessing `/dashboard`

3. **Race Condition in Auth State** ✅
   - ProtectedLayout now checks both `user` state AND `getToken()` in-memory token
   - This handles cases where token is set but state hasn't updated yet

### Files Modified:
- `src/app/(dashboard)/layout.tsx` - Added ProtectedLayout wrapper
- `src/app/(dashboard)/ProtectedLayout.tsx` - NEW: Auth protection component  
- `src/app/(dashboard)/page.tsx` - NEW: Dashboard index redirects to admin

### What Happens on Login:

1. User submits credentials at `/login`
2. Backend validates and returns `access_token` + sets `refresh_token` cookie
3. Frontend stores token in memory via `setToken()`
4. Frontend stores user data in React state via `setUser()`
5. Frontend navigates to `/dashboard`
6. `ProtectedLayout` checks: `isLoading` + (`user` || `token`)
7. If authenticated, renders dashboard
8. If NOT authenticated, redirects to `/login?from=/dashboard`

### Testing:

After making these changes:
1. Clear browser storage: `Ctrl+Shift+Delete` → Cookies/Cache
2. Restart backend: `cd apps/api && npx ts-node src/index.ts`
3. Restart frontend: `cd apps/web && npm run dev`
4. Try login again with:
   - Company: `pharmacore`
   - Username: `sysadmin`
   - Password: `Test@1234`

### If Still Broken:

Check browser DevTools:
- **Network tab**: Verify `/api/auth/login` returns `200` with `access_token` in response body
- **Application > Cookies**: Verify `refresh_token` cookie is present
- **Console**: Look for any JavaScript errors in `useAuth` or `ProtectedLayout`
