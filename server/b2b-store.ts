export interface B2BDocument {
  name: string;
  type: string;
  data: string;
}

export interface B2BApplication {
  id: string;
  email: string;
  representativeName: string;
  phoneNumber: string;
  address: string;
  companyName: string;
  document: B2BDocument;
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
}

const applications = new Map<string, B2BApplication>();

export function addApplication(app: B2BApplication): void {
  applications.set(app.id, app);
}

export function getApplicationByEmail(email: string): B2BApplication | undefined {
  for (const app of applications.values()) {
    if (app.email.toLowerCase() === email.toLowerCase()) return app;
  }
  return undefined;
}

export function getAllApplications(): B2BApplication[] {
  return Array.from(applications.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function getApplicationById(id: string): B2BApplication | undefined {
  return applications.get(id);
}

export function updateApplicationStatus(
  id: string,
  status: 'approved' | 'rejected',
  rejectionReason?: string
): B2BApplication | undefined {
  const app = applications.get(id);
  if (app) {
    app.status = status;
    app.rejectionReason = status === 'rejected' ? rejectionReason : undefined;
    app.updatedAt = new Date().toISOString();
  }
  return app;
}
