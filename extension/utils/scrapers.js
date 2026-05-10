// DOM selectors for job sites — LinkedIn, Indeed, Glassdoor, Monster,
// ZipRecruiter, Dice, SimplyHired, Wellfound, and CareerBuilder.
// Each scraper returns { job_title, company, job_description } or null.
// Falls back to JSON-LD structured data and page title when selectors miss.

const Scrapers = {
  detectSite() {
    const url = window.location.href;
    if (url.includes('linkedin.com')) return 'linkedin';
    if (url.includes('indeed.com')) return 'indeed';
    if (url.includes('glassdoor.com')) return 'glassdoor';
    if (url.includes('monster.com')) return 'monster';
    if (url.includes('ziprecruiter.com')) return 'ziprecruiter';
    if (url.includes('dice.com')) return 'dice';
    if (url.includes('simplyhired.com')) return 'simplyhired';
    if (url.includes('wellfound.com')) return 'wellfound';
    if (url.includes('careerbuilder.com')) return 'careerbuilder';
    return null;
  },

  // ── Helpers ────────────────────────────────────────────────────

  findText(selList) {
    for (const sel of selList) {
      try {
        const el = document.querySelector(sel);
        if (el && el.textContent.trim()) return el.textContent.trim();
      } catch { /* invalid selector, skip */ }
    }
    return '';
  },

  // Fallback: parse JSON-LD JobPosting structured data
  jsonLdJob() {
    try {
      const scripts = document.querySelectorAll('script[type="application/ld+json"]');
      for (const script of scripts) {
        const data = JSON.parse(script.textContent);
        const item = data?.['@graph'] ? data['@graph'].find((x) => x['@type'] === 'JobPosting') : data;
        if (item?.['@type'] !== 'JobPosting') continue;
        const title = item.title || '';
        const company = item.hiringOrganization?.name || item.employer?.name || '';
        const desc = item.description || '';
        if (title && company) return { job_title: title, company, job_description: desc };
      }
    } catch { /* not JSON or wrong shape */ }
    return null;
  },

  // Fallback: guess title from <title> tag ("Job Title - Company | Site")
  titleFromPage() {
    const t = document.title?.trim();
    if (!t) return '';
    // Strip common suffixes: "| LinkedIn", "- Glassdoor", etc.
    return t.replace(/\s*[-–|]\s*(LinkedIn|Indeed|Glassdoor|Monster|ZipRecruiter|Dice|SimplyHired|Wellfound|CareerBuilder).*$/i, '')
            .replace(/\s*\|\s*.*$/, '')
            .trim();
  },

  // ── LinkedIn ───────────────────────────────────────────────────

  linkedin() {
    const title = this.findText([
      '.job-details-jobs-unified-top-card__job-title h1',
      '.topcard__title',
      'h1[data-test-job-title]',
      '.jobs-unified-top-card__job-title',
      'h1.t-24',
      'h1',
    ]);

    const company = this.findText([
      '.job-details-jobs-unified-top-card__company-name a',
      '.topcard__org-name-link',
      '[data-test-job-company-name]',
      '.jobs-unified-top-card__company-name',
      '.job-details-jobs-unified-top-card__company-name',
    ]);

    const description = this.findText([
      '.jobs-description__content',
      '.jobs-description',
      '#job-details',
      '.job-details-jobs-unified-top-card__description-container',
      '.description__text',
      '.jobs-box__html-content',
      '[data-test-job-description]',
    ]);

    if (!title || !company) return this.jsonLdJob();
    return { job_title: title, company, job_description: description };
  },

  // ── Indeed ─────────────────────────────────────────────────────

  indeed() {
    const title = this.findText([
      'h1.jobsearch-JobInfoHeader-title',
      'h1[data-testid="jobsearch-JobInfoHeader-title"]',
      '.jobsearch-JobInfoHeader-title',
      'h1.icl-u-xs-mb--xs',
      'h1[data-testid="jobDetail-title"]',
      'h1[data-testid="simpler-jobTitle"]',
      '[data-testid="jobDetail-title"]',
      '.jobsearch-JobInfoHeader-title span',
      'h1',
    ]);

    const company = this.findText([
      '[data-testid="inlineHeader-companyName"]',
      '.jobsearch-InlineCompanyRating a',
      '.jobsearch-CompanyInfoContainer a',
      '.icl-u-lg-mr--sm a',
      '[data-testid="jobsearch-CompanyInfoContainer"] a',
      '[data-company-name]',
      '.jobsearch-CompanyReview--heading',
      'a[href*="/cmp/"]',
      'a[data-tn-element="companyName"]',
    ]);

    const description = this.findText([
      '#jobDescriptionText',
      '.jobsearch-jobDescriptionText',
      '[data-testid="jobDescriptionText"]',
      '#job-description',
      '[data-testid="jobDetail-description"]',
      '[id*="job-description"]',
      'div[class*="job-description"]',
    ]);

    if (!title || !company) return this.jsonLdJob();
    return { job_title: title, company, job_description: description };
  },

  // ── Glassdoor ──────────────────────────────────────────────────

  glassdoor() {
    const title = this.findText([
      '[data-test="job-title"]',
      '[data-test="jobDetailTitle"]',
      '.job-title',
      'h1[class*="JobDetails_jobTitle"]',
      'h1[class*="jobTitle"]',
      'h1[class*="title"]',
      'h1',
    ]);

    const company = this.findText([
      '[data-test="employer-name"]',
      '[data-test="employerName"]',
      '.employer-name',
      '.employerName',
      '[class*="employerName"]',
      'a[data-test="employer-name"]',
      '.employer-info a',
      'a[href*="/Overview/"]',
      '[class*="employer"] a',
    ]);

    const description = this.findText([
      '[data-test="job-description"]',
      '[data-test="jobDescriptionContent"]',
      '.job-description',
      '.jobDescriptionContent',
      '[class*="jobDescription"]',
      'div[class*="description"]',
      'section[class*="description"]',
      '[class*="JobDetails_jobDescription"]',
    ]);

    if (!title || !company) return this.jsonLdJob();
    return { job_title: title, company, job_description: description };
  },

  // ── Monster ────────────────────────────────────────────────────

  monster() {
    const title = this.findText([
      'h1.job-title',
      '[data-testid="jobTitle"]',
      '.job-header__title',
      'h1',
    ]);

    const company = this.findText([
      '[data-testid="companyName"]',
      '.job-header__company a',
      '.company-name',
      '.job-company',
      'a[data-testid="companyLink"]',
    ]);

    const description = this.findText([
      '[data-testid="jobDescription"]',
      '#jobDescription',
      '.job-description',
      '.job-details-body',
      '.details-content',
    ]);

    if (!title || !company) return this.jsonLdJob();
    return { job_title: title, company, job_description: description };
  },

  // ── ZipRecruiter ───────────────────────────────────────────────

  ziprecruiter() {
    const title = this.findText([
      'h1.job_title',
      '[data-testid="jobTitle"]',
      '.job_title',
      'h1',
    ]);

    const company = this.findText([
      '[data-testid="companyName"]',
      '.company_name',
      '.hiring_company a',
      'a.company_link',
    ]);

    const description = this.findText([
      '[data-testid="jobDescription"]',
      '.job_description',
      '#job_description',
      '.jobDescriptionSection',
      '.description',
    ]);

    if (!title || !company) return this.jsonLdJob();
    return { job_title: title, company, job_description: description };
  },

  // ── Dice ───────────────────────────────────────────────────────

  dice() {
    const title = this.findText([
      'h1[data-cy="jobTitle"]',
      '.jobTitle',
      '[data-testid="jobTitle"]',
      'h1',
    ]);

    const company = this.findText([
      '[data-cy="companyName"]',
      '.companyName',
      '[data-testid="companyName"]',
      '.employer-name',
    ]);

    const description = this.findText([
      '[data-cy="jobDescription"]',
      '#jobDescription',
      '.job-desc',
      '[data-testid="jobDescription"]',
    ]);

    if (!title || !company) return this.jsonLdJob();
    return { job_title: title, company, job_description: description };
  },

  // ── SimplyHired ────────────────────────────────────────────────

  simplyhired() {
    const title = this.findText([
      'h1[data-testid="jobTitle"]',
      '[data-testid="jobTitle"]',
      '.job-title',
      '.viewjob-title',
      'h1[class*="title"]',
      'h1',
    ]);

    const company = this.findText([
      '[data-testid="companyName"]',
      '[data-testid="employerName"]',
      '.company-name',
      '.employer-name',
      '.viewjob-company',
      '[data-automation="company-name"]',
      'a[class*="company"]',
    ]);

    const description = this.findText([
      '[data-testid="jobDescription"]',
      '#job-description',
      '.job-description',
      '.job-details',
      '[data-automation="job-description"]',
      '.viewjob-description',
      '[class*="description"]',
    ]);

    if (!title || !company) return this.jsonLdJob();
    return { job_title: title, company, job_description: description };
  },

  // ── Wellfound (formerly AngelList) ──────────────────────────────

  wellfound() {
    const title = this.findText([
      'h1[data-test="job-title"]',
      '.job-title',
      'h1',
      '[data-testid="jobTitle"]',
    ]);

    const company = this.findText([
      '[data-test="company-name"]',
      '.company-name',
      '.startup-name',
      '[data-testid="companyName"]',
    ]);

    const description = this.findText([
      '[data-test="job-description"]',
      '.job-description',
      '.job-details',
      '[data-testid="jobDescription"]',
      '.description',
    ]);

    if (!title || !company) return this.jsonLdJob();
    return { job_title: title, company, job_description: description };
  },

  // ── CareerBuilder ──────────────────────────────────────────────

  careerbuilder() {
    const title = this.findText([
      'h1.job-title',
      '[data-testid="job-title"]',
      '.title',
      'h1',
    ]);

    const company = this.findText([
      '[data-testid="company-name"]',
      '.company-name',
      '.employer',
      '.job-company',
    ]);

    const description = this.findText([
      '[data-testid="job-description"]',
      '#job-description',
      '.job-description',
      '.description',
      '.job-details',
    ]);

    if (!title || !company) return this.jsonLdJob();
    return { job_title: title, company, job_description: description };
  },

  // ── Dispatch ───────────────────────────────────────────────────

  scrape() {
    const site = this.detectSite();
    if (!site) return null;
    return this[site]();
  },
};
