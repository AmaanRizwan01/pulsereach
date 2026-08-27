/**
 * Pulsereach — Single-Page A4 Resume HTML Compiler
 * Compiles tailored resume data into pixel-perfect, 100% single-column A4 HTML with dynamic autofit spacing.
 */

export interface ResumeProject {
  name: string;
  technologies: string;
  period?: string;
  bullets: string[];
}

export interface ResumeExperience {
  company: string;
  role: string;
  period: string;
  bullets: string[];
}

export interface ResumeEducation {
  institution: string;
  location: string;
  degree: string;
  period: string;
  grade?: string;
}

export interface ResumeCertification {
  name: string;
  issuer: string;
}

export interface ResumeData {
  name: string;
  visaStatus: string;
  phone: string;
  email: string;
  linkedinUrl: string;
  githubUrl: string;
  portfolioUrl: string;
  headline?: string;
  summary: string;
  skills: {
    languages: string[];
    frontend: string[];
    backend: string[];
    cloudDevops: string[];
    databases: string[];
    tools: string[];
  };
  experience: ResumeExperience[];
  projects: ResumeProject[];
  education: ResumeEducation[];
  certifications?: ResumeCertification[];
}

interface SpacingProfile {
  baseFontSize: string;
  baseLineHeight: string;
  sectionMarginBottom: string;
  itemMarginBottom: string;
  bulletMarginBottom: string;
  pageMargin: string;
}

/**
 * Calculates adaptive typography and micro-spacing factors to fill the A4 page without spilling onto page 2.
 */
function calculateAdaptiveSpacing(data: ResumeData): SpacingProfile {
  const totalExpBullets = data.experience.reduce((sum, exp) => sum + exp.bullets.length, 0);
  const totalProjBullets = data.projects.reduce((sum, proj) => sum + proj.bullets.length, 0);
  const totalBullets = totalExpBullets + totalProjBullets;
  const projectCount = data.projects.length;
  const certCount = data.certifications?.length || 0;

  // Approximate total content line weight
  const estimatedLines =
    totalBullets * 1.15 +
    projectCount * 1.5 +
    data.experience.length * 1.5 +
    certCount * 1.0 +
    data.summary.length / 85 +
    14;

  if (estimatedLines > 44 || projectCount >= 4 || totalBullets > 13) {
    // High density mode (3-4 projects with 3-4 bullets each + full experience + skills)
    return {
      baseFontSize: '8.45pt',
      baseLineHeight: '1.22',
      sectionMarginBottom: '4.2px',
      itemMarginBottom: '2.8px',
      bulletMarginBottom: '1.2px',
      pageMargin: '5mm 8mm 5mm 8mm',
    };
  } else if (estimatedLines > 35) {
    // Medium density mode (3 projects with 3 bullets + 2 certs)
    return {
      baseFontSize: '8.75pt',
      baseLineHeight: '1.25',
      sectionMarginBottom: '5.5px',
      itemMarginBottom: '3.5px',
      bulletMarginBottom: '1.6px',
      pageMargin: '5.5mm 8mm 5.5mm 8mm',
    };
  } else {
    // Standard density mode (compact summary and balanced bullets)
    return {
      baseFontSize: '9.05pt',
      baseLineHeight: '1.30',
      sectionMarginBottom: '7.0px',
      itemMarginBottom: '4.2px',
      bulletMarginBottom: '2.0px',
      pageMargin: '6mm 8.5mm 6mm 8.5mm',
    };
  }
}

/**
 * Compiles a structured ResumeData object into pixel-perfect single-page A4 HTML matching the reference CV standard.
 */
export function generateResumeHtml(data: ResumeData): string {
  const spacing = calculateAdaptiveSpacing(data);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${data.name} - Resume</title>
<style>
  @page {
    size: A4;
    margin: ${spacing.pageMargin};
  }
  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }
  body {
    font-family: Arial, "Helvetica Neue", Helvetica, sans-serif;
    color: #000000;
    background: #ffffff;
    font-size: ${spacing.baseFontSize};
    line-height: ${spacing.baseLineHeight};
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  
  /* Header */
  .header {
    text-align: center;
    margin-bottom: ${spacing.sectionMarginBottom};
    padding-bottom: 2px;
  }
  .header-name {
    font-size: 16.5pt;
    font-weight: 700;
    letter-spacing: 0.5px;
    color: #000000;
    text-transform: uppercase;
    margin-bottom: 1.5px;
  }
  .header-sub {
    font-size: 8.4pt;
    color: #111111;
    margin-bottom: 1.5px;
    font-weight: 500;
  }
  .header-contact {
    font-size: 8.3pt;
    color: #111111;
  }
  .header-contact a {
    color: #000000;
    text-decoration: underline;
  }
  
  /* Section Styles */
  .section {
    margin-bottom: ${spacing.sectionMarginBottom};
  }
  .section-title {
    font-size: 9.2pt;
    font-weight: 700;
    text-transform: uppercase;
    color: #000000;
    border-bottom: 1px solid #000000;
    padding-bottom: 1px;
    margin-bottom: 2.5px;
    letter-spacing: 0.2px;
  }
  
  /* Professional Summary */
  .summary-text {
    font-size: ${spacing.baseFontSize};
    color: #111111;
    text-align: justify;
    line-height: ${spacing.baseLineHeight};
  }
  
  /* Experience & Projects */
  .item-block {
    margin-bottom: ${spacing.itemMarginBottom};
  }
  .exp-company {
    font-weight: 700;
    font-size: 8.7pt;
    color: #000000;
  }
  .exp-role-date {
    font-size: 8.3pt;
    color: #111111;
    margin-bottom: 1px;
  }
  .exp-role {
    font-style: italic;
  }
  
  .project-header-row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    font-size: 8.5pt;
    margin-bottom: 1px;
  }
  .project-title-tech {
    color: #000000;
  }
  .project-name {
    font-weight: 700;
  }
  .project-tech {
    font-weight: normal;
    color: #222222;
  }
  .project-date {
    font-weight: 700;
    color: #000000;
    text-align: right;
    white-space: nowrap;
    margin-left: 8px;
  }
  
  /* Bullets */
  ul.bullets {
    margin-left: 15px;
    padding-left: 0;
    list-style-type: disc;
  }
  ul.bullets li {
    font-size: ${spacing.baseFontSize};
    color: #111111;
    margin-bottom: ${spacing.bulletMarginBottom};
    line-height: ${spacing.baseLineHeight};
    text-align: justify;
  }
  
  /* Education */
  .edu-row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    font-size: 8.5pt;
  }
  .edu-inst {
    font-weight: 700;
    color: #000000;
  }
  .edu-date {
    font-weight: 700;
    color: #000000;
    white-space: nowrap;
  }
  .edu-deg {
    font-size: 8.3pt;
    color: #111111;
    margin-bottom: 2px;
  }

  /* Certifications */
  .cert-name {
    font-weight: 700;
    color: #000000;
  }
  .cert-issuer {
    color: #222222;
  }
  
  /* Technical Skills */
  .skills-container {
    display: flex;
    flex-direction: column;
    gap: 1.5px;
  }
  .skills-line {
    font-size: ${spacing.baseFontSize};
    color: #111111;
    line-height: 1.22;
  }
  .skills-category {
    font-weight: 700;
    color: #000000;
  }
</style>
</head>
<body>

<!-- Header -->
<div class="header">
  <div class="header-name">${data.name}</div>
  <div class="header-sub">${data.visaStatus}</div>
  <div class="header-contact">
    ${data.phone} | ${data.email} | <a href="${data.linkedinUrl}">LinkedIn</a> | <a href="${data.githubUrl}">GitHub</a> | <a href="${data.portfolioUrl}">Portfolio</a>
  </div>
</div>

<!-- 1. Professional Summary -->
<div class="section">
  <div class="section-title">PROFESSIONAL SUMMARY</div>
  <div class="summary-text">${data.summary}</div>
</div>

<!-- 2. Technical Skills -->
<div class="section">
  <div class="section-title">TECHNICAL SKILLS</div>
  <div class="skills-container">
    <div class="skills-line"><span class="skills-category">Languages:</span> ${data.skills.languages.join(', ')}</div>
    <div class="skills-line"><span class="skills-category">Frontend:</span> ${data.skills.frontend.join(', ')}</div>
    <div class="skills-line"><span class="skills-category">Backend & CMS:</span> ${data.skills.backend.join(', ')}</div>
    <div class="skills-line"><span class="skills-category">Cloud & DevOps:</span> ${data.skills.cloudDevops.join(', ')}</div>
    <div class="skills-line"><span class="skills-category">Databases & Caching:</span> ${data.skills.databases.join(', ')}</div>
    <div class="skills-line"><span class="skills-category">Tools & Methodologies:</span> ${data.skills.tools.join(', ')}</div>
  </div>
</div>

<!-- 3. Experience -->
<div class="section">
  <div class="section-title">EXPERIENCE</div>
  ${data.experience
    .map((exp) => {
      const cleanRole = exp.role.includes('|') ? exp.role.split('|')[0].trim() : exp.role;
      return `
  <div class="item-block">
    <div class="exp-company">${exp.company}</div>
    <div class="exp-role-date"><span class="exp-role">${cleanRole}</span> | ${exp.period}</div>
    <ul class="bullets">
      ${exp.bullets.map((b) => `<li>${b}</li>`).join('')}
    </ul>
  </div>`;
    })
    .join('')}
</div>

<!-- 4. Projects -->
<div class="section">
  <div class="section-title">PROJECTS</div>
  ${data.projects
    .map(
      (proj) => `
  <div class="item-block">
    <div class="project-header-row">
      <div class="project-title-tech">
        <span class="project-name">${proj.name}</span> | <span class="project-tech">${proj.technologies}</span>
      </div>
      <div class="project-date">${proj.period || ''}</div>
    </div>
    <ul class="bullets">
      ${proj.bullets.map((b) => `<li>${b}</li>`).join('')}
    </ul>
  </div>`
    )
    .join('')}
</div>

<!-- 5. Education -->
<div class="section">
  <div class="section-title">EDUCATION</div>
  ${data.education
    .map(
      (edu) => `
  <div class="item-block">
    <div class="edu-row">
      <span class="edu-inst">${edu.institution} - ${edu.location}</span>
      <span class="edu-date">${edu.period}</span>
    </div>
    <div class="edu-deg">${edu.degree}${edu.grade ? ` | CGPA: ${edu.grade}` : ''}</div>
  </div>`
    )
    .join('')}
</div>

<!-- 6. Certifications (Strict 1-Column ATS List) -->
${
  data.certifications && data.certifications.length > 0
    ? `
<div class="section">
  <div class="section-title">CERTIFICATIONS</div>
  <ul class="bullets">
    ${data.certifications
      .map(
        (cert) =>
          `<li><span class="cert-name">${cert.name}</span> | <span class="cert-issuer">${cert.issuer}</span></li>`
      )
      .join('')}
  </ul>
</div>`
    : ''
}

</body>
</html>`;
}
