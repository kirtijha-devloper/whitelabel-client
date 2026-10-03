import json
import os
import sys
import time
import base64
from playwright.sync_api import sync_playwright

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CONFIG_FILE = os.path.join(BASE_DIR, 'franchise.json')

def ensure_dummy_file(file_path, filename="sample.png"):
    """
    Returns the file path if exists, or generates a valid 1x1 dummy PNG image.
    (Bank passbook is mandatory in AddUser.jsx for merchant creation).
    """
    if file_path and os.path.exists(file_path):
        return os.path.abspath(file_path)

    dummy_dir = os.path.join(BASE_DIR, 'temp_docs')
    os.makedirs(dummy_dir, exist_ok=True)
    dummy_file = os.path.join(dummy_dir, filename)

    if not os.path.exists(dummy_file):
        # 1x1 transparent PNG
        png_bytes = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=")
        with open(dummy_file, "wb") as f:
            f.write(png_bytes)

    return dummy_file

def run():
    if not os.path.exists(CONFIG_FILE):
        print(f"❌ Configuration file '{CONFIG_FILE}' not found!")
        sys.exit(1)

    with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
        config = json.load(f)

    auth = config.get("auth", {})
    merchant = config.get("merchant", {})
    documents = config.get("documents", {})

    print("🚀 Launching Playwright browser...")
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=False, # Set to True if you prefer background run
            slow_mo=50      # Smooth execution
        )
        context = browser.new_context()
        page = context.new_page()

        try:
            target_url = auth.get("createMerchantUrl", "http://localhost:5173/super-franchise/create-user")
            
            # If a token is already present in merchantData.json, pre-inject it into sessionStorage to bypass login
            existing_token = auth.get("token")
            if existing_token:
                print("🔑 Existing token found in merchantData.json! Injecting into browser session...")
                page.goto("http://localhost:5173/login", wait_until="commit")
                page.evaluate("""(token) => {
                    sessionStorage.setItem('token', token);
                    sessionStorage.setItem('auth:session-only', '1');
                    localStorage.removeItem('token');
                }""", existing_token)

            print(f"🌐 Navigating to {target_url}...")
            page.goto(target_url, wait_until="networkidle")

            # Check if redirected to login
            if "/login" in page.url:
                print("🔑 Login required. Entering Super-Franchise credentials...")
                page.wait_for_selector('input[name="mobile"]', timeout=10000)
                page.fill('input[name="mobile"]', auth.get("mobile", ""))
                page.fill('input[name="password"]', auth.get("password", ""))
                page.click('button[type="submit"]:has-text("Send OTP")')

                print("⏳ Checking for OTP step...")
                try:
                    page.wait_for_selector('input[placeholder="Enter OTP"]', timeout=8000)
                    print("⚠️ OTP Screen is active! Please enter OTP in the browser or wait for auto-verify (up to 60s)...")
                    page.wait_for_url("**/super-franchise/**", timeout=60000)
                except Exception:
                    # If OTP was bypassed or redirected automatically
                    pass

                if "/super-franchise/create-user" not in page.url:
                    page.goto(target_url, wait_until="networkidle")

            # Extract JWT auth token from browser sessionStorage and update merchantData.json
            try:
                captured_token = page.evaluate("""() => {
                    return sessionStorage.getItem('token') || localStorage.getItem('token');
                }""")
                if captured_token:
                    print(f"💾 Captured Auth Token: {captured_token[:15]}...{captured_token[-10:]}")
                    auth["token"] = captured_token
                    config["auth"] = auth
                    with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
                        json.dump(config, f, indent=2)
                    print("✅ Saved latest Auth Token into merchantData.json!")
            except Exception as token_err:
                print(f"⚠️ Could not capture token: {token_err}")

            print("📋 Filling Merchant Creation Form...")
            page.wait_for_selector('form', timeout=15000)

            # 1. Ensure Role = 'merchant' is selected
            merchant_radio = page.locator('input[type="radio"][name="role"][value="franchise"]')
            if merchant_radio.is_visible():
                merchant_radio.check()

            # 2. General Information
            page.fill('input[name="name"]', merchant.get("name", ""))
            
            shop_name = merchant.get("company_or_shop_name")
            if shop_name:
                shop_input = page.locator('input[name="company_or_shop_name"]')
                if shop_input.is_visible():
                    shop_input.fill(shop_name)

            page.fill('input[name="email"]', merchant.get("email", ""))
            page.fill('input[name="mobile_number"]', merchant.get("mobile_number", ""))

            # 3. Gender
            gender = merchant.get("gender")
            if gender:
                gender_radio = page.locator(f'input[name="gender"][value="{gender.lower()}"]')
                if gender_radio.is_visible():
                    gender_radio.check()

            # 4. Date of Birth
            dob = merchant.get("dob")
            if dob:
                page.fill('input[name="dob"]', dob)

            # 5. Password
            password = merchant.get("password")
            if password:
                pwd_input = page.locator('input[name="password"]')
                if pwd_input.is_visible():
                    pwd_input.fill(password)

            # 6. Address
            page.fill('input[name="address1"]', merchant.get("address1", ""))
            if merchant.get("address2"):
                page.fill('input[name="address2"]', merchant.get("address2"))
            page.fill('input[name="city"]', merchant.get("city", ""))
            page.fill('input[name="district"]', merchant.get("district", ""))
            page.fill('input[name="pincode"]', merchant.get("pincode", ""))
            page.fill('input[name="state"]', merchant.get("state", ""))
            if merchant.get("country"):
                page.fill('input[name="country"]', merchant.get("country"))

            # 7. Document Numbers
            page.fill('input[name="aadhar_number"]', merchant.get("aadhar_number", ""))
            page.fill('input[name="pan_number"]', merchant.get("pan_number", ""))

            # 8. File Uploads (Passbook is mandatory for merchant)
            passbook_path = ensure_dummy_file(documents.get("bank_passbook"), "passbook.png")
            print(f"📎 Attaching Bank Passbook: {passbook_path}")
            page.set_input_files('input#upload-bank_passbook', passbook_path)

            if documents.get("aadhar_photo") and os.path.exists(documents.get("aadhar_photo")):
                page.set_input_files('input#upload-aadhar_photo', documents.get("aadhar_photo"))

            if documents.get("aadhar_back_photo") and os.path.exists(documents.get("aadhar_back_photo")):
                page.set_input_files('input#upload-aadhar_back_photo', documents.get("aadhar_back_photo"))

            if documents.get("pan_photo") and os.path.exists(documents.get("pan_photo")):
                page.set_input_files('input#upload-pan_photo', documents.get("pan_photo"))

            if documents.get("shop_photo") and os.path.exists(documents.get("shop_photo")):
                page.set_input_files('input#upload-shop_photo', documents.get("shop_photo"))

            # 9. Settlement Type
            settlement_type = merchant.get("settlement_type", "today_settlement")
            settlement_radio = page.locator(f'input[name="settlement_type"][value="{settlement_type}"]')
            if settlement_radio.is_visible():
                settlement_radio.check()

            # 10. Submit Form
            print("🚀 Submitting Franchise form...")
            submit_btn = page.locator('button[type="submit"]:has-text("Submit")')
            submit_btn.scroll_into_view_if_needed()
            submit_btn.click()

            # Wait for response toast or page redirect
            print("⏳ Waiting for creation to complete...")
            page.wait_for_timeout(4000)

            try:
                toast = page.locator('.Toastify__toast--success').first.text_content(timeout=5000)
                if toast:
                    print(f"✅ Success Toast: {toast}")
            except Exception:
                print(f"ℹ️ Finished submission. Current URL: {page.url}")

            print("🎉 Franchise creation automated successfully!")
            time.sleep(3)

        except Exception as e:
            print(f"❌ Error during execution: {e}")
        finally:
            browser.close()

if __name__ == '__main__':
    run()
