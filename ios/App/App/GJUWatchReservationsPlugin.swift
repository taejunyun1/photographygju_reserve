import Foundation
import Capacitor
import WatchConnectivity

@objc(GJUWatchReservationsPlugin)
public class GJUWatchReservationsPlugin: CAPPlugin, CAPBridgedPlugin, WCSessionDelegate {
    public let identifier = "GJUWatchReservationsPlugin"
    public let jsName = "GJUWatchReservations"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "sync", returnType: CAPPluginReturnPromise)
    ]

    private let contextKey = "GJUWatchReservationContext"
    private let maxReservations = 10

    public override func load() {
        configureSessionIfAvailable()
    }

    @objc func sync(_ call: CAPPluginCall) {
        guard let rawReservations = call.getArray("reservations", JSObject.self) else {
            call.reject("reservations 배열이 필요합니다.")
            return
        }

        let syncedAt = call.getString("syncedAt") ?? ISO8601DateFormatter().string(from: Date())
        let reservations = rawReservations.prefix(maxReservations).map { sanitizeReservation($0) }
        let context: [String: Any] = [
            "syncedAt": syncedAt,
            "reservations": reservations
        ]

        UserDefaults.standard.set(context, forKey: contextKey)

        var delivered = false
        var paired = false
        var installed = false
        var errorMessage = ""

        if WCSession.isSupported() {
            configureSessionIfAvailable()
            let session = WCSession.default
            paired = session.isPaired
            installed = session.isWatchAppInstalled
            if paired && installed {
                do {
                    try session.updateApplicationContext(context)
                    delivered = true
                } catch {
                    errorMessage = error.localizedDescription
                }
            }
        }

        call.resolve([
            "supported": WCSession.isSupported(),
            "paired": paired,
            "installed": installed,
            "delivered": delivered,
            "reservations": reservations.count,
            "syncedAt": syncedAt,
            "error": errorMessage
        ])
    }

    private func configureSessionIfAvailable() {
        guard WCSession.isSupported() else { return }
        let session = WCSession.default
        session.delegate = self
        if session.activationState == .notActivated {
            session.activate()
        }
    }

    private func sanitizeReservation(_ reservation: JSObject) -> [String: String] {
        [
            "id": clippedString(reservation["id"]),
            "type": clippedString(reservation["type"]),
            "status": clippedString(reservation["status"]),
            "title": clippedString(reservation["title"], fallback: "예약"),
            "subtitle": clippedString(reservation["subtitle"]),
            "dateLabel": clippedString(reservation["dateLabel"])
        ]
    }

    private func clippedString(_ value: Any?, fallback: String = "") -> String {
        let raw: String
        if let string = value as? String {
            raw = string
        } else if let value {
            raw = String(describing: value)
        } else {
            raw = fallback
        }
        return String(raw.trimmingCharacters(in: .whitespacesAndNewlines).prefix(90))
    }

    public func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {}

    public func sessionDidBecomeInactive(_ session: WCSession) {}

    public func sessionDidDeactivate(_ session: WCSession) {
        session.activate()
    }
}
