"""
My AI Works — data.json 更新腳本
用途：從 GAS API 下載最新作品資料，存成 data.json 供新使用者秒開使用。
使用方式：每次上架新作品後，在此目錄執行 python update_data.py
"""
import urllib.request, json, os

GAS_URL = "https://script.google.com/macros/s/AKfycbxAt2_Sp1QsY-ajrnSA0_uyWXaYG2gdN2fJO55ktGbexB60Suj_RA9Q4V1Qj0Iih279FA/exec"
OUTPUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data.json")

print("[update_data] Fetching from GAS API...")
req = urllib.request.Request(f"{GAS_URL}?action=getPortfolio")
with urllib.request.urlopen(req, timeout=30) as resp:
    raw = resp.read().decode("utf-8")

data = json.loads(raw)
if data.get("status") != "success":
    print(f"[ERROR] GAS returned: {data.get('message', 'unknown error')}")
    exit(1)

items = data["data"]
with open(OUTPUT, "w", encoding="utf-8") as f:
    json.dump(items, f, ensure_ascii=False)

size_kb = os.path.getsize(OUTPUT) / 1024
print(f"[OK] data.json updated: {len(items)} items, {size_kb:.1f} KB")
