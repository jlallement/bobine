import SwiftUI

@main
struct PastillesApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}

struct Pastille: Identifiable {
    let id = UUID()
    let couleur: Color
}

struct ContentView: View {
    private static let palette: [Color] = [.red, .green, .blue, .orange, .purple, .pink, .teal, .indigo]

    @State private var pastilles = [
        Pastille(couleur: .red),
        Pastille(couleur: .green),
        Pastille(couleur: .blue),
    ]
    @State private var total = 3

    var body: some View {
        VStack(spacing: 20) {
            Text("Pastilles")
                .font(.largeTitle.bold())
            Text("\(total) pastilles")
                .font(.title3)
                .foregroundStyle(.secondary)

            LazyVGrid(columns: Array(repeating: GridItem(.fixed(64)), count: 4), spacing: 16) {
                ForEach(pastilles) { pastille in
                    Circle()
                        .fill(pastille.couleur)
                        .frame(width: 56, height: 56)
                        .transition(.scale.combined(with: .opacity))
                }
            }
            .padding(.top, 12)

            Spacer()

            HStack(spacing: 16) {
                Button("Ajouter") {
                    withAnimation(.spring(duration: 0.6)) {
                        pastilles.append(Pastille(couleur: Self.palette.randomElement() ?? .gray))
                    }
                }
                .buttonStyle(.borderedProminent)

                Button("Mélanger") {
                    withAnimation(.easeInOut(duration: 0.8)) {
                        pastilles.shuffle()
                    }
                }
                .buttonStyle(.borderedProminent)
                .tint(.yellow)
            }
            .controlSize(.large)
        }
        .padding(32)
    }
}

#Preview {
    ContentView()
}
