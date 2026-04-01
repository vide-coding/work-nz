// E2E Test Specs - re-export all spec files
// This file serves as a central export point for all test specs
// Individual specs are auto-discovered by Playwright based on testDir config

// Import all specs to ensure they're registered
import './workspace.spec'
import './projects.spec'
import './settings.spec'
import './project-workspace.spec'
import './git-module.spec'
import './file-module.spec'
import './git-module.integration.spec'
import './file-module.integration.spec'
