import { NextRequest, NextResponse } from 'next/server';
import { DUMMY_USERS } from '@/lib/dummy-data';

// POST /api/v1/auth/login
// PRD §11.2 - Autentikasi, mengembalikan JWT Access Token
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = body;

    if (!email) {
      return NextResponse.json(
        {
          type: 'https://api.e-performiq.com/errors/missing-credentials',
          title: 'Authentication Failed',
          status: 400,
          detail: 'Email dan password wajib diisi.',
          instance: '/api/v1/auth/login',
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    const user = DUMMY_USERS.find((u) => u.email.toLowerCase() === email.toLowerCase());

    if (!user) {
      return NextResponse.json(
        {
          type: 'https://api.e-performiq.com/errors/invalid-credentials',
          title: 'Authentication Failed',
          status: 401,
          detail: 'Email atau kata sandi tidak valid. Silakan periksa kembali.',
          instance: '/api/v1/auth/login',
          timestamp: new Date().toISOString(),
        },
        { status: 401 }
      );
    }

    // Simulate JWT token generation (dummy, not real JWT)
    const mockToken = Buffer.from(JSON.stringify({ userId: user.id, role: user.role, exp: Date.now() + 8 * 3600 * 1000 })).toString('base64');
    const mockRefreshToken = Buffer.from(JSON.stringify({ userId: user.id, exp: Date.now() + 7 * 24 * 3600 * 1000 })).toString('base64');

    return NextResponse.json({
      status: 'success',
      data: {
        access_token: `eyJhbGciOiJIUzI1NiJ9.${mockToken}.mock_signature`,
        refresh_token: `eyJhbGciOiJIUzI1NiJ9.${mockRefreshToken}.mock_refresh_signature`,
        token_type: 'Bearer',
        expires_in: 28800,
        user: {
          id: user.id,
          employee_id: user.employeeId,
          email: user.email,
          name: user.name,
          role: user.role,
          department: user.department,
          position: user.position,
          avatar_url: user.avatarUrl,
        },
      },
    });
  } catch {
    return NextResponse.json(
      {
        type: 'https://api.e-performiq.com/errors/internal-error',
        title: 'Internal Server Error',
        status: 500,
        detail: 'Terjadi kesalahan internal pada server. Silakan coba kembali.',
        instance: '/api/v1/auth/login',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
