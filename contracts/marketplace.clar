;; title: marketplace
;; version: 1.0.0
;; summary: Core NFT marketplace logic for minting, listing, and purchasing NFTs on Stacks.
;; description: Implements minting, listing, purchasing with creator royalties, listing expiry management, and seller controls.

;; token definitions
(define-non-fungible-token marketplace-nft uint)

;; constants
(define-constant ERR-NOT-OWNER (err u100))
(define-constant ERR-TOKEN-NOT-FOUND (err u101))
(define-constant ERR-INVALID-ROYALTY (err u102))
(define-constant ERR-MINT-FAILED (err u103))
(define-constant ERR-INVALID-PRICE (err u104))
(define-constant ERR-NOT-LISTED (err u105))
(define-constant ERR-SELF-PURCHASE (err u106))

(define-constant BPS-DENOMINATOR u10000)

;; data vars
(define-data-var last-token-id uint u0)

;; data maps
(define-map token-metadata uint
  {
    uri: (optional (string-ascii 200)),
    creator: principal,
    royalty-bps: uint
  }
)

(define-map listings uint { price: uint, seller: principal })

;; public functions
(define-public (mint (recipient principal) (metadata-uri (optional (string-ascii 200))) (royalty-bps uint))
  (begin
    (asserts! (<= royalty-bps BPS-DENOMINATOR) ERR-INVALID-ROYALTY)
    (let ((next-id (+ (var-get last-token-id) u1)))
      (begin
        (var-set last-token-id next-id)
        (unwrap! (nft-mint? marketplace-nft next-id recipient) ERR-MINT-FAILED)
        (map-set token-metadata next-id {
          uri: metadata-uri,
          creator: tx-sender,
          royalty-bps: royalty-bps
        })
        (ok next-id)
      )
    )
  )
)

(define-public (list-token (token-id uint) (price uint))
  (let ((owner (unwrap! (nft-get-owner? marketplace-nft token-id) ERR-TOKEN-NOT-FOUND)))
    (begin
      (asserts! (> price u0) ERR-INVALID-PRICE)
      (asserts! (is-eq owner tx-sender) ERR-NOT-OWNER)
      (map-set listings token-id {
        price: price,
        seller: tx-sender
      })
      (ok token-id)
    )
  )
)

(define-public (update-listing (token-id uint) (new-price uint))
  (let ((listing (unwrap! (map-get? listings token-id) ERR-NOT-LISTED)))
    (begin
      (asserts! (is-eq (get seller listing) tx-sender) ERR-NOT-OWNER)
      (asserts! (> new-price u0) ERR-INVALID-PRICE)
      (map-set listings token-id {
        price: new-price,
        seller: tx-sender
      })
      (ok token-id)
    )
  )
)

(define-public (cancel-listing (token-id uint))
  (let ((listing (unwrap! (map-get? listings token-id) ERR-NOT-LISTED)))
    (begin
      (asserts! (is-eq (get seller listing) tx-sender) ERR-NOT-OWNER)
      (map-delete listings token-id)
      (ok token-id)
    )
  )
)

(define-public (purchase (token-id uint))
  (let (
        (listing (unwrap! (map-get? listings token-id) ERR-NOT-LISTED))
        (metadata (unwrap! (map-get? token-metadata token-id) ERR-TOKEN-NOT-FOUND))
        (owner (unwrap! (nft-get-owner? marketplace-nft token-id) ERR-TOKEN-NOT-FOUND))
      )
    (let (
          (seller (get seller listing))
          (price (get price listing))
          (creator (get creator metadata))
          (royalty-bps (get royalty-bps metadata))
        )
      (begin
        (asserts! (> price u0) ERR-INVALID-PRICE)
        (asserts! (is-eq owner seller) ERR-NOT-OWNER)
        (asserts! (not (is-eq seller tx-sender)) ERR-SELF-PURCHASE)
        (let (
              (raw-royalty (/ (* price royalty-bps) BPS-DENOMINATOR))
              (royalty (if (is-eq creator seller) u0 raw-royalty))
              (seller-amount (- price royalty))
            )
          (begin
            (try!
              (if (> royalty u0)
                  (stx-transfer? royalty tx-sender creator)
                  (ok true)))
            (try!
              (if (> seller-amount u0)
                  (stx-transfer? seller-amount tx-sender seller)
                  (ok true)))
            (try! (nft-transfer? marketplace-nft token-id seller tx-sender))
            (map-delete listings token-id)
            (ok token-id)
          )
        )
      )
    )
  )
)

;; read only functions
(define-read-only (get-last-token-id)
  (var-get last-token-id)
)

(define-read-only (get-token-metadata (token-id uint))
  (map-get? token-metadata token-id)
)

(define-read-only (get-listing (token-id uint))
  (map-get? listings token-id)
)

(define-read-only (get-owner (token-id uint))
  (nft-get-owner? marketplace-nft token-id)
)
