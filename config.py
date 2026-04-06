# config.py — Candidate profile, job preferences, and agent configuration

CANDIDATE_PROFILE = {
    "name": "Tanzil Ahmed",
    "location": "Bengaluru, India",
    "email": "",  # fill in via .env or here
    "phone": "",  # fill in via .env or here
    "linkedin": "",  # e.g. linkedin.com/in/tanzil-ahmed
    "github": "",   # e.g. github.com/tanzil-ahmed

    "summary": (
        "Full-Stack Java + MERN developer with hands-on Data Engineering experience "
        "across Kafka, PySpark, GCP, and Azure. Passionate about building scalable "
        "backend systems and data pipelines. Based in Bengaluru, open to hybrid/remote roles."
    ),

    "skills": {
        "languages": ["Java", "Python", "JavaScript", "TypeScript", "SQL"],
        "frontend": ["React", "Next.js", "HTML", "CSS", "Tailwind CSS"],
        "backend": ["Spring Boot", "Node.js", "Express.js", "REST APIs", "GraphQL"],
        "data_engineering": ["Apache Kafka", "PySpark", "Apache Spark", "Hadoop", "Airflow"],
        "cloud": ["Google Cloud Platform (GCP)", "Microsoft Azure", "AWS (basic)"],
        "databases": ["PostgreSQL", "MySQL", "MongoDB", "Redis"],
        "devops": ["Docker", "Kubernetes", "Git", "CI/CD", "Jenkins"],
        "tools": ["IntelliJ IDEA", "VS Code", "Postman", "Jira", "Confluence"],
    },

    "experience": [
        # Add your actual experience entries here
        # {
        #     "company": "Company Name",
        #     "role": "Role Title",
        #     "duration": "Jan 2023 – Present",
        #     "highlights": [
        #         "Built X using Y that achieved Z",
        #     ]
        # }
    ],

    "education": [
        # {
        #     "degree": "B.Tech in Computer Science",
        #     "institution": "University Name",
        #     "year": "2022"
        # }
    ],

    "certifications": [
        # "Google Cloud Professional Data Engineer",
        # "AWS Certified Developer – Associate",
    ],

    "notice_period": "Immediate / 15 days",
    "preferred_work_mode": ["hybrid", "remote", "on-site"],
    "expected_ctc": "",   # e.g. "12–18 LPA"
    "current_ctc": "",
}

TARGET_ROLES = [
    "Full Stack Developer",
    "Full Stack Engineer",
    "Data Engineer",
    "Associate Software Engineer",
    "Software Engineer",
    "Backend Developer",
    "Backend Engineer",
    "Java Developer",
    "MERN Stack Developer",
]

JOB_PREFERENCES = {
    "locations": ["Bengaluru", "Remote", "Hybrid India"],
    "experience_level": ["entry", "associate", "mid"],  # target seniority bands
    "min_experience_years": 0,
    "max_experience_years": 4,
    "employment_type": ["full-time"],
    "industries": [
        "Technology",
        "Fintech",
        "SaaS",
        "E-commerce",
        "Data & Analytics",
        "Cloud Services",
    ],
    "company_size_preference": ["startup", "mid-size", "enterprise"],
    "avoid_companies": [],   # blacklist — add names as needed
    "preferred_companies": [],  # wishlist — add names as needed
}

SEARCH_CONFIG = {
    "max_jobs_per_run": 20,
    "job_boards": ["linkedin", "naukri", "indeed", "glassdoor", "wellfound"],
    "search_keywords": TARGET_ROLES,
    "freshness_days": 7,   # only fetch jobs posted within this window
}

OUTPUT_CONFIG = {
    "output_dir": "output/",
    "cv_format": "docx",           # "docx" or "pdf"
    "cover_letter_format": "docx",
    "tracker_db": "jobs_tracker.db",  # SQLite fallback; switch to postgres via .env
}

# ---------------------------------------------------------------------------
# API keys are loaded from .env — do NOT hardcode them here.
# Required keys in .env:
#   ANTHROPIC_API_KEY
#   TAVILY_API_KEY
#   EXA_API_KEY
#   POSTGRES_URL          (optional — for tracker; falls back to SQLite)
# ---------------------------------------------------------------------------
