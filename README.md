# EduFlow Analytics - Exam Application

A comprehensive educational assessment platform with analytics and feedback management.

## Project Structure

```
exam-application/
├── frontend/
│   └── eduflow-analytics/     # React + TypeScript frontend application
│       ├── src/
│       │   ├── components/    # React components
│       │   ├── pages/         # Page components (student & teacher)
│       │   ├── lib/           # Utilities and context
│       │   └── integrations/  # Supabase integration
│       ├── package.json
│       └── vite.config.ts
│
├── backend/                   # Backend API (to be developed)
│   └── README.md             # Backend setup instructions
│
└── README.md                  # This file
```

## Frontend Setup

### Prerequisites
- Node.js 16+ or Bun
- npm or bun package manager

### Installation

```bash
cd frontend/eduflow-analytics
npm install
# or
bun install
```

### Development

```bash
npm run dev
# or
bun run dev
```

The application will start at `http://localhost:8081`

### Build

```bash
npm run build
# or
bun run build
```

### Testing

```bash
npm run test
# or
bun run test
```

### Linting

```bash
npm run lint
# or
bun run lint
```

## Technology Stack

### Frontend
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **UI Components**: Shadcn/ui
- **Styling**: Tailwind CSS
- **State Management**: React Context API
- **HTTP Client**: Supabase JS
- **Testing**: Vitest
- **Code Quality**: ESLint

### Backend (Coming Soon)
- To be implemented

## Features

### Student Features
- Take tests with timed assessments
- View personal analytics and performance metrics
- Access test results and feedback
- Profile management
- Check leaderboard rankings

### Teacher Features
- Create and publish tests
- Manage test questions (MCQ, True/False, Short answer)
- View student performance analytics
- Send feedback to students
- Export results to CSV
- Monitor class performance trends

## Authentication

The application uses Supabase for authentication. Users can sign up as either:
- **Students**: Access assessments and view results
- **Teachers**: Create tests and manage assessments

## Database

The project uses Supabase (PostgreSQL) with the following main entities:
- `profiles` - User information (students vs teachers)
- `tests` - Test definitions
- `questions` - Test questions
- `test_attempts` - Student test submissions
- `student_responses` - Individual question responses
- `feedback` - Teacher feedback for students
- `user_roles` - Role management

## Development Workflow

1. Create a feature branch: `git checkout -b feature/your-feature`
2. Make changes and commit: `git commit -m "Add feature"`
3. Push to branch: `git push origin feature/your-feature`
4. Open a Pull Request on GitHub

## Current Status

✅ Frontend: Complete with all features
⏳ Backend: Ready for development
📊 Database: Configured with Supabase

## Contributing

Please follow the existing code style and patterns. Ensure all tests pass before submitting PR.

## License

MIT

## Contact

For questions or support, contact the development team.
