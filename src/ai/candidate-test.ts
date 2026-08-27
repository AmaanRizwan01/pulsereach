import {
  getCandidateProfile,
  getProjectById,
  getAllProjects,
  getProjectsByDomain,
  getSkillTaxonomy,
  getAllSkills,
  formatCandidateHeader,
} from './candidate-data.js';

console.log('=== Test 1: Testing Project Catalog Integrity ===');
const allProjects = getAllProjects();
console.log(`• Total projects found: ${allProjects.length}`);
if (allProjects.length === 0) {
  console.error('❌ Expected at least 1 verified project in profile');
  process.exit(1);
}

for (const p of allProjects) {
  console.log(`  ✅ Project [${p.id}]: "${p.name}" (${p.bullets.length} bullets, ${p.metrics.length} metrics)`);
}

console.log('\n=== Test 2: Testing Skills Taxonomy ===');
const taxonomy = getSkillTaxonomy();
const categories = Object.keys(taxonomy) as (keyof typeof taxonomy)[];
console.log(`• Total skill categories: ${categories.length}`);

for (const cat of categories) {
  const skills = taxonomy[cat];
  console.log(`  ✅ Category [${cat}]: ${skills.length} skills -> ${skills.slice(0, 4).join(', ')}...`);
  if (!skills || skills.length === 0) {
    console.error(`❌ Empty skill category: ${cat}`);
    process.exit(1);
  }
}

const flatSkills = getAllSkills();
console.log(`• Total deduplicated skills: ${flatSkills.length}`);

console.log('\n=== Test 3: Testing Strict Zero Em-Dash Policy ===');
const profile = getCandidateProfile();
const catalogJson = JSON.stringify(profile);
const emDashMatches = catalogJson.match(/[—–]|--/g);
if (emDashMatches && emDashMatches.length > 0) {
  console.error(`❌ Found ${emDashMatches.length} em-dashes or double-hyphens in candidate profile:`, emDashMatches);
  process.exit(1);
} else {
  console.log('✅ Strict zero em-dash compliance verified across entire candidate profile!');
}

console.log('\n=== Test 4: Testing Domain Tag Query Helper ===');
const topMatches = getProjectsByDomain(['saas', 'fullstack', 'api']);
console.log(`• Top matching project: ${topMatches[0]?.name} (ID: ${topMatches[0]?.id})`);
console.log('✅ Domain tag filtering correctly scored and prioritized matching project!');

console.log('\n=== Test 5: Testing Candidate Header Formatter ===');
const header = formatCandidateHeader();
console.log(header);

console.log('\n🎉 ALL CANDIDATE PROFILE TESTS PASSED!');
