# 📄 Pulsereach — Candidate Profile Customization Guide

This guide explains how to format and seed your candidate profile into Pulsereach so that the AI engine can generate **FAANG-grade, highly tailored, single-page A4 CVs and cover letters** anchored to your real career achievements.

---

## 🎯 The Truth-Anchoring Standard (Zero Hallucination Policy)

Pulsereach strictly enforces **truth-anchoring**:
- Every bullet point, metric, technology, and diploma generated in tailored resumes must stem directly from your verified profile in `profile.json` (or your Supabase database).
- The AI will **never** invent fake degrees, fake companies, or nonexistent metrics.
- The richer and more detailed your master profile is, the higher the tailored ATS match score (≥ 85%) will be across diverse job openings.

---

## 🏗️ Profile Structure & Schema

Your profile is stored in `profile.json` (which is gitignored to protect your privacy) or directly in Supabase table `candidate_profiles`.

Here is the JSON schema:

```json
{
  "name": "Your Full Name",
  "visaStatus": "Dubai, UAE | UAE Residence Visa Holder | Available Immediately",
  "phone": "+971-50-000-0000",
  "email": "your_email@example.com",
  "linkedinUrl": "https://www.linkedin.com/in/your-profile/",
  "githubUrl": "https://github.com/your-username/",
  "portfolioUrl": "https://your-portfolio.vercel.app/",
  "defaultHeadline": "Software Engineer | Full-Stack, Backend & Cloud Infrastructure",
  "defaultSummary": "Product-minded Software Engineer with extensive experience building production full-stack platforms and distributed cloud systems.",
  "skills": {
    "languages": ["TypeScript", "JavaScript", "Python", "SQL", "HTML5", "CSS3"],
    "frontend": ["React.js", "Next.js (App Router)", "Tailwind CSS", "Redux Toolkit"],
    "backend": ["Node.js", "Express.js", "FastAPI", "REST APIs", "GraphQL"],
    "cloudDevops": ["Docker", "Linux Administration", "CI/CD Actions", "Cloudflare"],
    "databases": ["PostgreSQL", "Supabase", "Redis", "Prisma ORM"],
    "tools": ["Git / GitHub", "Postman", "Playwright", "Jest"]
  },
  "experience": [
    {
      "company": "Your Past Company",
      "role": "Software Engineer Intern",
      "period": "Jun 2025 - Dec 2025",
      "domainTags": ["fullstack", "react", "node"],
      "bullets": [
        "Architected core user analytics dashboard using React and Tailwind CSS, increasing page load speed by 35%.",
        "Engineered RESTful microservices with Node.js and PostgreSQL handling 50,000+ daily transactions."
      ]
    }
  ],
  "projects": {
    "project_id_1": {
      "id": "project_id_1",
      "name": "Project Name",
      "domainTags": ["saas", "nextjs", "fullstack", "postgresql"],
      "technologies": "Next.js, TypeScript, PostgreSQL, Docker",
      "period": "2025 - Present",
      "bullets": [
        "Engineered multi-tenant SaaS application with sub-second API response times.",
        "Implemented end-to-end OAuth2 and role-based access control for 1,000+ active users."
      ],
      "metrics": ["Sub-second latency", "1,000+ active users", "99.9% uptime"]
    }
  },
  "education": [
    {
      "institution": "Your University",
      "location": "City, Country",
      "degree": "Bachelor of Science in Computer Science",
      "period": "2021 - 2025",
      "grade": "3.8"
    }
  ],
  "certifications": [
    {
      "name": "AWS Certified Solutions Architect",
      "issuer": "Amazon Web Services"
    }
  ]
}
```

---

## ✍️ Best Practices for Writing Impactful Bullets

### 1. Use the Google XYZ Metric Bullet Format
Every bullet point should follow:
> **Accomplished [X] as measured by [Y] by doing [Z]**

*Examples:*
- ❌ *"Worked on backend API endpoints."*
- ✅ *"Engineered 14 high-throughput REST API endpoints in Node.js/PostgreSQL, reducing latency by 45% for 20k+ daily users."*
- ❌ *"Created frontend with React."*
- ✅ *"Architected reactive Next.js 14 App Router UI with optimistic caching, elevating Core Web Vitals score to 98/100."*

### 2. Add Rich Domain Tags
Tag each project with 4-8 keywords (e.g. `["saas", "fullstack", "devops", "fintech", "docker"]`).
The AI engine uses these domain tags to automatically select the **top 3 most relevant projects** when applying to specific job vacancies (e.g. DevOps vs. Frontend vs. Full-Stack roles).

### 3. Strict Zero Em-Dash Policy
Avoid em-dashes (`—` or `--`) in your profile text. Use standard commas, colons, or parentheses.

---

## 🚀 Seeding Your Profile into Supabase

1. Copy `profile.example.json` to `profile.json`:
   ```bash
   cp profile.example.json profile.json
   ```
2. Edit `profile.json` with your real information.
3. Run the profile seed command:
   ```bash
   pnpm profile:seed
   ```
4. Output should confirm:
   ```
   ✅ Master candidate profile successfully seeded to Supabase!
   ```

You are now ready to run Pulsereach!
