;; Aetos Counter - A simple counter contract
;; Deployed by Aetos (Lux OpenClaw)

;; Data vars
(define-data-var counter uint u0)
(define-data-var last-caller (optional principal) none)

;; Read-only functions
(define-read-only (get-counter)
  (ok (var-get counter))
)

(define-read-only (get-last-caller)
  (ok (var-get last-caller))
)

;; Public functions
(define-public (increment)
  (begin
    (var-set counter (+ (var-get counter) u1))
    (var-set last-caller (some tx-sender))
    (ok (var-get counter))
  )
)

(define-public (decrement)
  (begin
    (asserts! (> (var-get counter) u0) (err u1))
    (var-set counter (- (var-get counter) u1))
    (var-set last-caller (some tx-sender))
    (ok (var-get counter))
  )
)

;; Bulk increment (costs more gas but fun)
(define-public (increment-by (amount uint))
  (begin
    (var-set counter (+ (var-get counter) amount))
    (var-set last-caller (some tx-sender))
    (ok (var-get counter))
  )
)
