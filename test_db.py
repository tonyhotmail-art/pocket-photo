import asyncio
from playwright.sync_api import sync_playwright

def verify_tenant_id():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # We need to make sure the app doesn't crash on the initial render.
        # But wait, why is it loading forever?
        # Let's check console logs.
        page.on("console", lambda msg: print(f"Browser console: {msg.text}"))
        page.on("pageerror", lambda err: print(f"Browser error: {err}"))

        print("Navigating to /test-slug-123 ...")
        page.goto("http://localhost:3000/test-slug-123")
        page.wait_for_timeout(10000)

        screenshot_path = "/home/jules/verification/tenantId_page_with_logs.png"
        page.screenshot(path=screenshot_path)
        print(f"Screenshot saved to {screenshot_path}")
        browser.close()

if __name__ == "__main__":
    verify_tenant_id()
