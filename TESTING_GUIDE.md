# 🧪 QUICK TESTING GUIDE — TradeDock Integration

## 🚀 START TESTING IN 3 STEPS

### Step 1: Backend (Already Running ✅)

```bash
# Check backend status
curl http://localhost:8000/api/v2/crypto/5min/signals

# View live logs
tail -f /tmp/backend_v2_logs.txt

# Restart if needed
cd /Users/camil/CascadeProjects/windsurf-project/backend
kill $(cat /tmp/backend_v2_pid.txt)
source ../.venv/bin/activate && nohup python main.py > /tmp/backend_v2_logs.txt 2>&1 & echo $! > /tmp/backend_v2_pid.txt
```

---

### Step 2: Frontend

```bash
cd /Users/camil/CascadeProjects/windsurf-project/frontend
npm run dev
```

**Open:** http://localhost:3000/terminal

---

### Step 3: Wait for Signal

**Current Status:**
- ✅ 6 active markets detected
- ⏳ Waiting for BTC movement >0.15%

**What triggers a signal:**
- BTC moves **>0.15%** within a 5-min interval
- Edge calculated as **>5%**

**When signal appears, you'll see:**
1. **Flash animation** (green/red border)
2. **Signal panel** with:
   - Direction: "UP SIGNAL" or "DOWN SIGNAL"
   - BTC MOVE: +0.45%
   - EDGE: +8.0%
   - Confidence: HIGH
3. **BUY button** shows: "BUY UP • $50"

**Click the button → TradeDock opens**

---

## 🎯 WHAT TO VERIFY

### When Signal Appears

**Check Crypto5MinPanel:**
- [ ] Flash animation visible (green for UP, red for DOWN)
- [ ] BTC move % displayed correctly
- [ ] Edge % displayed correctly
- [ ] Confidence level shown (LOW/MEDIUM/HIGH)
- [ ] Button shows: "BUY [DIRECTION] • $[AMOUNT]"

**Click BUY Button:**
- [ ] TradeDock slides up from bottom
- [ ] Market question matches signal
- [ ] Outcome pre-selected (YES for UP, NO for DOWN)
- [ ] Amount pre-filled (Kelly-sized)
- [ ] Edge displayed (matches signal)
- [ ] Risk level shown (inverse of confidence)
- [ ] Kelly Fraction displayed

**Execute Trade:**
- [ ] Connect wallet prompt appears (if not connected)
- [ ] Approve USDC button appears (first time only)
- [ ] Execute Trade button becomes clickable
- [ ] Transaction submits successfully
- [ ] Toast notification shows "✅ Trade Executed!"
- [ ] TradeDock auto-closes after 2 seconds

---

## 📊 KELLY SIZING VERIFICATION

### Example Signal

**Given:**
- Edge: 8% (0.08)
- True Probability: 60% (0.60)
- Bankroll: $1,000

**Expected Kelly Calculation:**
1. Kelly Full = 0.08 / (1 - 0.60) = 0.20 (20%)
2. Kelly Fractional (0.25x) = 0.20 × 0.25 = 0.05 (5%)
3. Recommended Bet = $1,000 × 0.05 = **$50**

**Verify:**
- [ ] Button shows: "BUY UP • $50" ✅
- [ ] TradeDock Amount field = $50 ✅
- [ ] Kelly Fraction = 5.0% ✅

---

## 🔧 MANUAL SIGNAL SIMULATION (FOR TESTING)

If you want to test without waiting for real BTC movement:

### Option 1: Mock Signal in Frontend

**File:** `frontend/components/crypto-5min-panel.tsx`

**Add test button:**
```tsx
{/* Add this below the Crypto5MinPanel header */}
<button
  onClick={() => {
    const mockSignal = {
      market: "btc-updown-5m-test",
      slug: "btc-updown-5m-test",
      question: "Bitcoin Up or Down - TEST",
      direction: "UP",
      btcMove: 0.45,
      marketPrice: 0.52,
      trueProbability: 0.68,
      edge: 0.16,
      confidence: "high",
      timeRemaining: 180,
      recommendedSide: "BUY_UP",
      tokenId: "0x123abc...",
      volume: 5000,
    }
    onTradeClick?.(mockSignal, 100)
  }}
  className="absolute top-2 right-2 text-[10px] bg-yellow-500/20 text-yellow-500 px-2 py-1 border border-yellow-500/30"
>
  TEST
</button>
```

**Then:**
1. Refresh frontend
2. Click "TEST" button in Crypto5MinPanel
3. TradeDock should open with pre-filled data

---

### Option 2: Modify Backend Threshold

**File:** `backend/engine/crypto_5min_scanner.py`

**Change:**
```python
MIN_MOVE_PCT = 0.15  # 0.15% move = signal starts
```

**To:**
```python
MIN_MOVE_PCT = 0.01  # 0.01% move = signal starts (TESTING ONLY)
```

**Then restart backend:**
```bash
kill $(cat /tmp/backend_v2_pid.txt)
cd /Users/camil/CascadeProjects/windsurf-project/backend
source ../.venv/bin/activate && nohup python main.py > /tmp/backend_v2_logs.txt 2>&1 & echo $! > /tmp/backend_v2_pid.txt
```

**Wait 10 seconds, then check:**
```bash
curl http://localhost:8000/api/v2/crypto/5min/signals | grep -o '"signals":\[.*\]' | head -c 200
```

**Should see:** `"signals":[{...}]` with signal data

---

## 🐛 TROUBLESHOOTING

### Backend Not Responding

**Check if running:**
```bash
ps aux | grep "python main.py"
```

**Check logs:**
```bash
tail -30 /tmp/backend_v2_logs.txt
```

**Restart:**
```bash
cd /Users/camil/CascadeProjects/windsurf-project/backend
kill $(cat /tmp/backend_v2_pid.txt) 2>/dev/null
source ../.venv/bin/activate && python main.py
```

---

### Frontend Not Loading Crypto5MinPanel

**Check browser console:**
- Press F12 → Console tab
- Look for errors related to "Crypto5MinPanel" or "crypto/5min/signals"

**Check API connection:**
```bash
curl http://localhost:8000/api/v2/crypto/5min/signals
```

**Should return JSON with:**
- `active_markets`: array of markets
- `signals`: array (empty or with signals)
- `btcPrice`: number
- `timestamp`: number

---

### TradeDock Not Opening

**Verify:**
1. Open browser console (F12)
2. Click BUY button
3. Look for errors

**Common issues:**
- `onTradeClick` not passed to Crypto5MinPanel
- `selectedMarket` state not updating
- TradeDock import missing

**Fix:**
```bash
cd /Users/camil/CascadeProjects/windsurf-project/frontend
# Restart dev server
npm run dev
```

---

### Kelly Amount Incorrect

**Debug:**
1. Open `frontend/components/crypto-5min-panel.tsx`
2. Add console.log to `calculateKellyFraction`:
```tsx
function calculateKellyFraction(edge: number, probability: number): number {
  const kellyFull = edge / (1 - probability)
  const kellyFractional = kellyFull * 0.25
  console.log(`Kelly Debug: edge=${edge}, prob=${probability}, full=${kellyFull}, fractional=${kellyFractional}`)
  return Math.min(kellyFractional, 0.10)
}
```
3. Click BUY button
4. Check console for debug output

---

## ✅ SUCCESS CRITERIA

### Integration Working When:

- [x] Backend running (PID exists in `/tmp/backend_v2_pid.txt`)
- [x] API returns active markets
- [ ] Frontend loads Crypto5MinPanel without errors
- [ ] Signal appears when BTC moves >0.15%
- [ ] Button shows Kelly-sized amount
- [ ] Click BUY → TradeDock opens
- [ ] TradeDock pre-filled correctly
- [ ] Amount matches Kelly calculation
- [ ] Outcome matches signal direction
- [ ] Execute trade → Transaction succeeds

### Current Status:

**Backend:** ✅ Running (PID 1657)
**API:** ✅ Working (6 markets detected)
**Frontend:** ⏳ Ready to test

---

## 📝 TESTING NOTES

### Record These Metrics:

When signal appears:
- **BTC Move %:** _______
- **Edge %:** _______
- **Confidence:** _______
- **Kelly Amount:** $_______
- **Time to TradeDock Open:** _______ seconds
- **Trade Executed:** Yes / No
- **Transaction Hash:** _______

After 100 signals:
- **Total Signals:** _______
- **Trades Executed:** _______
- **Win Rate:** _______%
- **Average Edge Realized:** _______%
- **Total Profit:** $_______
- **Max Drawdown:** $_______

---

## 🎯 NEXT AFTER SUCCESSFUL TEST

1. **Paper trade 10 signals** → Collect calibration data
2. **Compare predicted edge vs realized edge** → Adjust sigmoid if needed
3. **Test different Kelly fractions** (0.1x, 0.25x, 0.5x) → Find optimal
4. **Backtest on historical data** → Verify model accuracy
5. **Real trading with small amounts** ($10-50 per trade)
6. **Scale up** when 70%+ win rate confirmed

---

**🚀 Everything is ready. Launch `npm run dev` and wait for BTC to move!**
