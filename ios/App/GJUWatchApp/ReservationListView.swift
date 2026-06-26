import SwiftUI
import WatchConnectivity

struct WatchReservation: Identifiable, Hashable {
    let id: String
    let type: String
    let status: String
    let title: String
    let subtitle: String
    let dateLabel: String

    init(dictionary: [String: Any]) {
        id = Self.text(dictionary["id"], fallback: UUID().uuidString)
        type = Self.text(dictionary["type"])
        status = Self.text(dictionary["status"])
        title = Self.text(dictionary["title"], fallback: "예약")
        subtitle = Self.text(dictionary["subtitle"])
        dateLabel = Self.text(dictionary["dateLabel"])
    }

    static func text(_ value: Any?, fallback: String = "") -> String {
        if let string = value as? String {
            return string.trimmingCharacters(in: .whitespacesAndNewlines)
        }
        if let value {
            return String(describing: value).trimmingCharacters(in: .whitespacesAndNewlines)
        }
        return fallback
    }
}

final class WatchReservationStore: NSObject, ObservableObject, WCSessionDelegate {
    @Published private(set) var reservations: [WatchReservation] = []
    @Published private(set) var syncedAt = ""

    override init() {
        super.init()
        configureSession()
        load(context: WCSession.isSupported() ? WCSession.default.receivedApplicationContext : [:])
    }

    private func configureSession() {
        guard WCSession.isSupported() else { return }
        let session = WCSession.default
        session.delegate = self
        session.activate()
    }

    private func load(context: [String: Any]) {
        let items = context["reservations"] as? [[String: Any]] ?? []
        DispatchQueue.main.async {
            self.reservations = items.map(WatchReservation.init(dictionary:))
            self.syncedAt = WatchReservation.text(context["syncedAt"])
        }
    }

    func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {}

    func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
        load(context: applicationContext)
    }
}

struct ReservationListView: View {
    @StateObject private var store = WatchReservationStore()

    var body: some View {
        NavigationStack {
            Group {
                if store.reservations.isEmpty {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("예약 없음")
                            .font(.headline)
                        Text("iPhone 앱에서 내 예약을 열면 Apple Watch와 동기화됩니다.")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                } else {
                    List(store.reservations) { reservation in
                        VStack(alignment: .leading, spacing: 4) {
                            Text(reservation.title)
                                .font(.headline)
                                .lineLimit(2)
                            if !reservation.dateLabel.isEmpty {
                                Text(reservation.dateLabel)
                                    .font(.caption2)
                                    .foregroundStyle(.secondary)
                            }
                            if !reservation.subtitle.isEmpty {
                                Text(reservation.subtitle)
                                    .font(.caption)
                                    .lineLimit(2)
                            }
                        }
                    }
                }
            }
            .navigationTitle("내 예약")
        }
    }
}
