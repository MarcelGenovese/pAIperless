import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function DashboardPage() {
  return (
    <div className="container mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-primary mb-2">Dashboard</h1>
        <p className="text-muted-foreground">Welcome to pAIperless</p>
      </div>

      <div className="grid md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Documents Processed</CardTitle>
            <CardDescription>Total documents</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-primary">0</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Queue Length</CardTitle>
            <CardDescription>Pending documents</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-primary">0</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Worker Status</CardTitle>
            <CardDescription>System status</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-600">Ready</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Getting Started</CardTitle>
          <CardDescription>Start processing documents</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-semibold mb-2">1. Drop Files</h3>
            <p className="text-sm text-muted-foreground">
              Place PDF files in the <code className="bg-gray-100 px-2 py-1 rounded">./consume</code> folder
            </p>
          </div>
          <div>
            <h3 className="font-semibold mb-2">2. Monitor Progress</h3>
            <p className="text-sm text-muted-foreground">
              Watch documents being processed automatically
            </p>
          </div>
          <div>
            <h3 className="font-semibold mb-2">3. Check Paperless</h3>
            <p className="text-sm text-muted-foreground">
              View tagged and analyzed documents in Paperless-NGX
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
