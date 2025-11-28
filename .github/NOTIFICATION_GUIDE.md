# GitHub Actions Email Notification Guide

## Problem
You're receiving email notifications every time the CI/CD pipeline runs, even when builds fail.

## Solution Options

### Option 1: Disable Email Notifications (Recommended)
1. Go to your GitHub repository
2. Click on your profile picture (top right)
3. Go to **Settings** → **Notifications**
4. Scroll to **Actions**
5. Uncheck **Send notifications for failed workflows only**
6. Or completely disable **Email** notifications for Actions

### Option 2: Configure Per-Repository Notifications
1. Go to your repository: `https://github.com/Kartikvyas1604/Meshcrypt`
2. Click **Watch** button (top right)
3. Select **Custom**
4. Uncheck **Actions**

### Option 3: Email Filter Rules
If you use Gmail, create a filter:
1. Search: `from:(notifications@github.com) "CI/CD Pipeline"`
2. Create filter
3. Check **Skip Inbox** and **Mark as read**
4. Or apply label for easy review later

### Option 4: Workflow-Level Notifications (Advanced)
Add notification step only on failure:

```yaml
jobs:
  notify:
    runs-on: ubuntu-latest
    if: failure()
    needs: [test, build]
    steps:
      - name: Send notification
        run: echo "Build failed"
```

## Current Status
The CI/CD pipeline is configured with `continue-on-error: true` for:
- Linting
- Tests
- TypeScript build
- Circuit compilation

This means failures won't block the pipeline, but you'll still receive notifications if the overall workflow fails.

## Best Practice
**Recommended:** Use Option 2 (Per-Repository Notifications) to only receive notifications for important events like pull requests and releases, not for every push.
