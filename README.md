# Finance Planner

A web-based financial planning tool built with Next.js for calculating investment growth and retirement planning.

## Features

### Investment Calculator

Calculate the future value of your investments with support for lump-sum amounts and step-up SIPs (Systematic Investment Plans):

- **Inputs:** Lump-sum investment, monthly SIP amount, annual step-up percentage, expected annual return, investment period, and inflation rate
- **Outputs:**
  - Future Value (FV) – projected wealth at the end of the investment period
  - Total Invested – sum of all contributions
  - Gain – profit from investments
  - CAGR (Compound Annual Growth Rate) – annualized return percentage
  - XIRR (Extended Internal Rate of Return) – time-weighted return accounting for irregular cash flows
  - Inflation-Adjusted FV – future value adjusted for inflation
- **Additional features:** Growth visualization chart, scenario management with save/load/duplicate functionality, and localStorage persistence

### Retirement Planner

Model your retirement corpus needs and plan your withdrawal strategy:

- **Plan your retirement:** Input current age, retirement age, lifespan, current monthly expenses, investment returns (pre- and post-retirement), and inflation
- **Expense phases:** Configure custom expense phases during retirement (e.g., high-spending early years, reduced expenses later)
- **Outputs:**
  - Corpus needed at retirement – total capital required to sustain your retirement
  - Required monthly SIP – how much you need to invest monthly before retirement
  - Year-by-year drawdown table showing corpus balance and annual expenses
  - Growth visualization chart
- **Multi-age comparison:** Compare retirement corpus needs across different retirement ages (e.g., retire 5 years earlier or later) to inform your decisions
- **Handoff to Calculator:** With one click, seamlessly pass your corpus target to the Investment Calculator to plan your savings strategy

## Getting Started

### Prerequisites

- Node.js 18+ and npm

### Installation

```bash
npm install
```

### Development

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to see the application.

The app is fully client-side with localStorage-based persistence — no backend or database required.

### Testing

Run the test suite:

```bash
npm test
```

For continuous testing during development:

```bash
npm run test:watch
```

### Production Build

Create an optimized production build:

```bash
npm run build
```

Start the production server:

```bash
npm start
```

## Deployment

### Deploy to Vercel

The app is ready to deploy on Vercel with zero configuration:

1. Push your repository to GitHub (or GitLab / Bitbucket)
2. Go to [vercel.com](https://vercel.com) and sign in
3. Click "Add New Project" and import your repository
4. Vercel automatically detects Next.js and configures the build settings
5. Click "Deploy" — no environment variables required

The app will be live immediately. Vercel automatically handles:
- Next.js framework detection
- Production build optimization
- Static site generation and prerendering
- Edge caching and global CDN distribution

For more details, see the [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying).

## Project Structure

- `/app` – Next.js App Router pages and layout
- `/components` – React components for both tabs and their subcomponents
- `/lib/finance` – Core calculation engines (accumulation, returns, retirement math, utilities)
- `/store` – Client-side state management (scenarios, retirement plans, localStorage)
- `/public` – Static assets

## Technologies

- **Next.js 16** – React framework for production
- **React 19** – UI library
- **TypeScript** – Type-safe code
- **Tailwind CSS 4** – Utility-first styling
- **Recharts** – Interactive data visualization
- **Vitest** – Unit testing framework
- **ESLint** – Code linting

## Architecture Notes

All calculations are performed client-side in the browser. Scenarios and retirement plans are stored in browser localStorage with versioned keys, ensuring persistence across sessions without requiring backend infrastructure. The shared calculation engine in `/lib/finance` is used by both tabs and is thoroughly tested.

## License

This project is open source.
