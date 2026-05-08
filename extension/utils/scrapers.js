// DOM selectors for LinkedIn, Indeed, and Glassdoor job pages.
// Each scraper returns { job_title, company, job_description } or null if not a job page.

const Scrapers = {
  detectSite() {
    const url = window.location.href;
    if (url.includes('linkedin.com')) return 'linkedin';
    if (url.includes('indeed.com')) return 'indeed';
    if (url.includes('glassdoor.com')) return 'glassdoor';
    return null;
  },

  linkedin() {
    // Try multiple selector strategies (LinkedIn updates their DOM frequently)
    const selectors = {
      title: [
        '.job-details-jobs-unified-top-card__job-title h1',
        '.topcard__title',
        'h1[data-test-job-title]',
        '.jobs-unified-top-card__job-title',
        'h1.t-24',
      ],
      company: [
        '.job-details-jobs-unified-top-card__company-name a',
        '.topcard__org-name-link',
        '[data-test-job-company-name]',
        '.jobs-unified-top-card__company-name',
        '.job-details-jobs-unified-top-card__company-name',
      ],
      description: [
        '.jobs-description__content',
        '.jobs-description',
        '#job-details',
        '.job-details-jobs-unified-top-card__description-container',
        '.description__text',
        '.jobs-box__html-content',
        '[data-test-job-description]',
      ],
    };

    const findText = (selList) => {
      for (const sel of selList) {
        const el = document.querySelector(sel);
        if (el && el.textContent.trim()) return el.textContent.trim();
      }
      return '';
    };

    const title = findText(selectors.title);
    const company = findText(selectors.company);
    const description = findText(selectors.description);

    if (!title || !company) return null;
    return { job_title: title, company, job_description: description };
  },

  indeed() {
    const selectors = {
      title: [
        '.jobsearch-JobInfoHeader-title',
        'h1[data-testid="jobsearch-JobInfoHeader-title"]',
        '.icl-u-xs-mb--xs',
        'h1.jobsearch-JobInfoHeader-title',
        'h1.icl-u-xs-mb--xs',
      ],
      company: [
        '[data-testid="inlineHeader-companyName"]',
        '.jobsearch-InlineCompanyRating a',
        '.jobsearch-CompanyInfoContainer a',
        '.icl-u-lg-mr--sm a',
      ],
      description: [
        '#jobDescriptionText',
        '.jobsearch-jobDescriptionText',
        '[data-testid="jobDescriptionText"]',
        '#job-description',
      ],
    };

    const findText = (selList) => {
      for (const sel of selList) {
        const el = document.querySelector(sel);
        if (el && el.textContent.trim()) return el.textContent.trim();
      }
      return '';
    };

    const title = findText(selectors.title);
    const company = findText(selectors.company);
    const description = findText(selectors.description);

    if (!title || !company) return null;
    return { job_title: title, company, job_description: description };
  },

  glassdoor() {
    const selectors = {
      title: [
        '[data-test="job-title"]',
        '.job-title',
        'h1[data-test="job-title"]',
        '[data-test="jobDetailTitle"]',
        'h1.heading_Heading__*',
      ],
      company: [
        '[data-test="employer-name"]',
        '.employer-name',
        '[data-test="employerName"]',
        'a[data-test="employer-name"]',
      ],
      description: [
        '[data-test="job-description"]',
        '.job-description',
        '.jobDescriptionContent',
        '[data-test="jobDescriptionContent"]',
        '.JobDetails_jobDescription__*',
        'div[class*="jobDescription"]',
      ],
    };

    const findText = (selList) => {
      for (const sel of selList) {
        // Handle wildcard class selectors
        if (sel.includes('*')) {
          const parts = sel.split('*');
          const prefix = parts[0].replace(/\./g, '').replace(/\[/g, '').replace(/\]/g, '');
          const all = document.querySelectorAll('[class]');
          for (const el of all) {
            if (el.className && typeof el.className === 'string' && el.className.includes(prefix)) {
              const text = el.textContent.trim();
              if (text) return text;
            }
          }
          continue;
        }
        const el = document.querySelector(sel);
        if (el && el.textContent.trim()) return el.textContent.trim();
      }
      return '';
    };

    const title = findText(selectors.title);
    const company = findText(selectors.company);
    const description = findText(selectors.description);

    if (!title || !company) return null;
    return { job_title: title, company, job_description: description };
  },

  scrape() {
    const site = this.detectSite();
    if (!site) return null;
    return this[site]();
  },
};
