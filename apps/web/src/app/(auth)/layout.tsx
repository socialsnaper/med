export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary text-primary-foreground text-xl font-bold mb-3">
            D
          </div>
          <h1 className="text-xl font-semibold tracking-tight">Digilog</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Pharmaceutical Management System
          </p>
        </div>
        {children}
      </div>
    </div>
  )
}
