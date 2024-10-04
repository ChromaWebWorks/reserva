const firebaseConfig = {
                apiKey: "AIzaSyACMK8-XbLmdRAEVUx3prQO7HxFRjaeHP4",
                authDomain: "baresperanca-cca31.firebaseapp.com",
                projectId: "baresperanca-cca31",
                storageBucket: "baresperanca-cca31.appspot.com",
                messagingSenderId: "320253941927",
                appId: "1:320253941927:web:6ec1be91f1342da3caa382",
                measurementId: "G-YBVNRCFNNZ"
            };

            firebase.initializeApp(firebaseConfig);
            firebase.analytics();
            const db = firebase.firestore();

            let countdownInterval;
            let confirmationButtonAdded = false;

            function getExpirationDate() {
                const date = new Date();
                date.setHours(date.getHours() + 24);
                return date;
            }

            function cleanupExpiredEntries() {
                const now = new Date();

                db.collection("queue")
                    .where("expirationDate", "<=", now)
                    .get()
                    .then((snapshot) => {
                        snapshot.forEach((doc) => {
                            doc.ref.delete();
                        });
                    });

                db.collection("reservations")
                    .where("expirationDate", "<=", now)
                    .get()
                    .then((snapshot) => {
                        snapshot.forEach((doc) => {
                            doc.ref.delete();
                        });
                    });
            }

            function checkQueueStatus() {
                return db
                    .collection("settings")
                    .doc("queueStatus")
                    .get()
                    .then((doc) => {
                        if (doc.exists) {
                            return doc.data().active;
                        } else {
                            console.log("No such document!");
                            return false;
                        }
                    })
                    .catch((error) => {
                        console.log("Error getting document:", error);
                        return false;
                    });
            }

            function updateQueue() {
                const userId = localStorage.getItem("userId");
                if (!userId) {
                    document.getElementById("queueScreen").classList.add("hidden");
                    document.getElementById("fila").classList.remove("hidden");
                    document.getElementById("reservas").classList.remove("hidden");
                    return;
                }

                db.collection("queue")
                    .doc(userId)
                    .get()
                    .then((doc) => {
                        if (doc.exists) {
                            const userData = doc.data();
                            const queuePosition = document.getElementById("queuePosition");
                            const estimatedTime = document.getElementById("estimatedTime");
                            const turnMessage = document.getElementById("turnMessage");

                            document.getElementById("queueScreen").classList.remove("hidden");
                            document.getElementById("fila").classList.add("hidden");
                            document.getElementById("reservas").classList.add("hidden");

                            if (userData.position === 0) {
                                queuePosition.textContent = "Sua vez chegou!";
                                turnMessage.textContent =
                                    "Sua vez chegou! Por favor, compareça à mesa em até 3 minutos.";
                                turnMessage.classList.remove("hidden");
                                estimatedTime.classList.remove("hidden");

                                if (userData.turnStarted) {
                                    startCountdown(userId);
                                } else {
                                    handleUserTurn(userId);
                                }

                                if (!confirmationButtonAdded) {
                                    const confirmButton = document.createElement("button");
                                    confirmButton.textContent = "Confirmar Chegada";
                                    confirmButton.onclick = () => {
                                        removeFromQueue(userId);
                                    };
                                    document.getElementById("queueScreen").appendChild(confirmButton);
                                    confirmationButtonAdded = true;
                                }
                            } else {
                                estimatedTime.classList.add("hidden");
                                if (confirmationButtonAdded) {
                                    const confirmButton = document.querySelector("#queueScreen button");
                                    if (confirmButton) {
                                        confirmButton.remove();
                                    }
                                    confirmationButtonAdded = false;
                                }

                                if (userData.position === 1) {
                                    queuePosition.textContent = "1º";
                                    turnMessage.textContent = "Você é o próximo! Aguarde ser chamado para comparecer.";
                                    turnMessage.classList.remove("hidden");
                                } else {
                                    queuePosition.textContent = `${userData.position}º`;
                                    const estimatedMinutes = (userData.position - 1) * 5;
                                    turnMessage.textContent = `Tempo estimado de espera: ${estimatedMinutes} minutos`;
                                    turnMessage.classList.remove("hidden");
                                }
                            }
                        } else {
                            document.getElementById("queueScreen").classList.add("hidden");
                            document.getElementById("fila").classList.remove("hidden");
                            document.getElementById("reservas").classList.remove("hidden");
                            localStorage.removeItem("userId");
                        }
                    });
            }

            function generateQueueMessage(position) {
                const message = `Olá! Você está na fila do Bar Esperança. Sua posição atual é ${position}. Acompanhe sua posição aqui: ${window.location.href}`;
                return encodeURIComponent(message);
            }

            function removeFromQueue(userId) {
                db.collection("queue")
                    .doc(userId)
                    .delete()
                    .then(() => {
                        localStorage.removeItem("userId");
                        document.getElementById("queueScreen").classList.add("hidden");
                        document.getElementById("fila").classList.remove("hidden");
                        document.getElementById("reservas").classList.remove("hidden");
                        alert(
                            "Obrigado por ter esperado para frequentar o nosso Bar Esperança! Seja bem-vindo e aproveite sua visita!"
                        );
                    })
                    .catch((error) => {
                        console.error("Error removing document: ", error);
                    });
            }

            function handleUserTurn(docId) {
                const queuePosition = document.getElementById("queuePosition");
                const estimatedTime = document.getElementById("estimatedTime");
                const turnMessage = document.getElementById("turnMessage");

                queuePosition.textContent = "Sua vez chegou!";
                estimatedTime.textContent = "Você tem 3 minutos para comparecer à mesa.";
                turnMessage.textContent = "Sua vez chegou! Por favor, compareça à mesa em até 3 minutos.";
                turnMessage.classList.remove("hidden");

                db.collection("queue")
                    .doc(docId)
                    .update({
                        turnStarted: firebase.firestore.FieldValue.serverTimestamp()
                    })
                    .then(() => {
                        startCountdown(docId);
                    });
            }

            function startCountdown(docId) {
                db.collection("queue")
                    .doc(docId)
                    .get()
                    .then((doc) => {
                        if (doc.exists && doc.data().turnStarted) {
                            const turnStarted = doc.data().turnStarted.toDate();
                            const now = new Date();
                            let timeLeft = 180 - Math.floor((now - turnStarted) / 1000);

                            if (timeLeft > 0) {
                                const estimatedTime = document.getElementById("estimatedTime");

                                clearInterval(countdownInterval);
                                countdownInterval = setInterval(() => {
                                    timeLeft--;
                                    estimatedTime.textContent = `Tempo restante: ${Math.floor(timeLeft / 60)}:${(timeLeft % 60).toString().padStart(2, "0")}`;

                                    if (timeLeft <= 0) {
                                        clearInterval(countdownInterval);
                                        removeFromQueue(docId);
                                        alert("O tempo para comparecer à mesa expirou. Você foi removido da fila.");
                                    }
                                }, 1000);
                            } else {
                                removeFromQueue(docId);
                                alert("O tempo para comparecer à mesa expirou. Você foi removido da fila.");
                            }
                        }
                    });
            }

            setInterval(updateQueue, 5000);

            document.getElementById("queueForm").addEventListener("submit", function (e) {
                e.preventDefault();

                checkQueueStatus().then((isActive) => {
                    if (!isActive) {
                        showStatus("queueStatus", "A fila ainda não está disponível. Há lugares vagos no bar.", "info");
                        return;
                    }

                    const name = document.getElementById("name").value;
                    const phone = document.getElementById("phone").value;
                    const partySize = parseInt(document.getElementById("partySize").value);

                    db.collection("queue")
                        .orderBy("position", "desc")
                        .limit(1)
                        .get()
                        .then((snapshot) => {
                            let newPosition = 1;
                            if (!snapshot.empty) {
                                newPosition = snapshot.docs[0].data().position + 1;
                            }

                            return db.collection("queue").add({
                                name,
                                phone,
                                partySize,
                                position: newPosition,
                                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                                expirationDate: getExpirationDate(),
                                id: Date.now().toString()
                            });
                        })
                        .then((docRef) => {
                            localStorage.setItem("userPhone", phone);
                            localStorage.setItem("userId", docRef.id);
                            showStatus("queueStatus", "Você foi adicionado à fila com sucesso!", "success");

                            document.getElementById("fila").classList.add("hidden");
                            document.getElementById("reservas").classList.add("hidden");
                            document.getElementById("queueScreen").classList.remove("hidden");

                            updateQueue();
                        })
                        .catch((error) => {
                            showStatus("queueStatus", "Erro ao entrar na fila. Tente novamente.", "error");
                        });
                });
            });

            document.getElementById("leaveQueue").addEventListener("click", function () {
                const userId = localStorage.getItem("userId");

                db.collection("queue")
                    .doc(userId)
                    .get()
                    .then((doc) => {
                        if (doc.exists) {
                            doc.ref
                                .delete()
                                .then(() => {
                                    localStorage.removeItem("userId");

                                    document.getElementById("queueScreen").classList.add("hidden");
                                    document.getElementById("fila").classList.remove("hidden");
                                    document.getElementById("reservas").classList.remove("hidden");

                                    showStatus("queueStatus", "Você saiu da fila com sucesso.", "success");
                                })
                                .catch((error) => {
                                    showStatus("queueStatus", "Erro ao sair da fila. Tente novamente.", "error");
                                });
                        }
                    });
            });

            document.getElementById("reservationForm").addEventListener("submit", function (e) {
                e.preventDefault();

                const name = document.getElementById("reservationName").value;
                const phone = document.getElementById("reservationPhone").value;
                const date = document.getElementById("reservationDate").value;
                const time = document.getElementById("reservationTime").value;
                const partySize = parseInt(document.getElementById("reservationPartySize").value);
                const area = document.getElementById("reservationArea").value;

                const reservationDate = new Date(date);
                const dayOfWeek = reservationDate.getDay();

                if (dayOfWeek < 2 || dayOfWeek > 4) {
                    showStatus(
                        "reservationStatus",
                        "Desculpe, as reservas só são permitidas de terça a quinta-feira.",
                        "error"
                    );
                    return;
                }

                if (partySize > 6 && area !== "terreo") {
                    showStatus(
                        "reservationStatus",
                        "Grupos maiores que 6 pessoas só podem reservar no térreo.",
                        "error"
                    );
                    return;
                }

                const selectedTime = new Date(`2000-01-01T${time}`);
                const minTime = new Date(`2000-01-01T19:00`);
                if (selectedTime > minTime) {
                    showStatus("reservationStatus", "O horário máximo para reservas é 19:00.", "error");
                    return;
                }

                db.collection("reservations")
                    .where("date", "==", date)
                    .get()
                    .then((snapshot) => {
                        if (snapshot.size >= 5) {
                            showStatus(
                                "reservationStatus",
                                "Desculpe, o limite de reservas para este dia foi atingido.",
                                "error"
                            );
                        } else {
                            db.collection("reservations")
                                .add({
                                    name,
                                    phone,
                                    date,
                                    time,
                                    partySize,
                                    area,
                                    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                                    expirationDate: getExpirationDate()
                                })
                                .then(() => {
                                    showReservationConfirmation({ name, phone, date, time, partySize, area });
                                })
                                .catch((error) => {
                                    showStatus(
                                        "reservationStatus",
                                        "Erro ao fazer a reserva. Tente novamente.",
                                        "error"
                                    );
                                });
                        }
                    });
            });

            function generateReservationMessage(reservation) {
                const message = `Olá ${reservation.name}! Aqui estão os detalhes da sua reserva no Bar Esperança:\n
Data: ${reservation.date}
Horário: ${reservation.time}
Tamanho do grupo: ${reservation.partySize}
Área: ${reservation.area === "terreo" ? "Térreo" : "Primeiro Andar"}

Lembre-se: A tolerância de chegada é até às 19h. Após esse horário, a mesa será desfeita.

Agradecemos sua preferência e esperamos vê-lo em breve!`;
                return encodeURIComponent(message);
            }

            function showStatus(elementId, message, type) {
                const statusElement = document.getElementById(elementId);
                statusElement.textContent = message;
                statusElement.className = type;
            }

            function showReservationConfirmation(reservation) {
                const confirmationSection = document.getElementById("reservationConfirmation");
                const detailsDiv = document.getElementById("reservationDetails");

                detailsDiv.innerHTML = `
        <p><strong>Nome:</strong> ${reservation.name}</p>
        <p><strong>Telefone:</strong> ${reservation.phone}</p>
        <p><strong>Data:</strong> ${reservation.date}</p>
        <p><strong>Horário:</strong> ${reservation.time}</p>
        <p><strong>Tamanho do grupo:</strong> ${reservation.partySize}</p>
        <p><strong>Área:</strong> ${reservation.area === "terreo" ? "Térreo" : "Primeiro Andar"}</p>
        <p><strong>Status:</strong> Confirmada</p>
      `;

                // Store the reservation details in localStorage
                localStorage.setItem("lastReservation", JSON.stringify(reservation));

                document.getElementById("fila").classList.add("hidden");
                document.getElementById("reservas").classList.add("hidden");
                confirmationSection.classList.remove("hidden");
            }

            document.addEventListener("DOMContentLoaded", function () {
                const shareQueuePositionBtn = document.getElementById("shareQueuePosition");
                shareQueuePositionBtn.addEventListener("click", function () {
                    const userId = localStorage.getItem("userId");
                    const userPhone = localStorage.getItem("userPhone");
                    if (userId && userPhone) {
                        db.collection("queue")
                            .doc(userId)
                            .get()
                            .then((doc) => {
                                if (doc.exists) {
                                    const position = doc.data().position;
                                    const message = generateQueueMessage(position);
                                    window.open(`https://wa.me/${userPhone}?text=${message}`, "_blank");
                                }
                            });
                    }
                });

                const sendWhatsAppBtn = document.getElementById("sendWhatsApp");
                sendWhatsAppBtn.addEventListener("click", function () {
                    const reservationDetails = JSON.parse(localStorage.getItem("lastReservation"));
                    if (reservationDetails) {
                        const message = generateReservationMessage(reservationDetails);
                        window.open(`https://wa.me/${reservationDetails.phone}?text=${message}`, "_blank");
                    }
                });

                // Existing code...
                updateQueue();
                cleanupExpiredEntries();
                startQueueStatusCheck();

                const feedbackBox = document.getElementById("feedbackBox");
                const feedbackToggle = document.getElementById("feedbackToggle");
                const feedbackContent = document.getElementById("feedbackContent");
                const ratingStars = document.querySelectorAll(".star");
                const feedbackRating = document.getElementById("feedbackRating");

                feedbackToggle.addEventListener("click", function () {
                    feedbackBox.classList.toggle("collapsed");
                    feedbackContent.classList.toggle("hidden");
                });

                ratingStars.forEach((star) => {
                    star.addEventListener("click", function () {
                        const rating = this.getAttribute("data-rating");
                        feedbackRating.value = rating;
                        ratingStars.forEach((s) => {
                            s.classList.toggle("active", s.getAttribute("data-rating") <= rating);
                        });
                    });
                });

                document.getElementById("feedbackForm").addEventListener("submit", function (e) {
                    e.preventDefault();

                    const name = document.getElementById("feedbackName").value;
                    const rating = feedbackRating.value;
                    const feedbackText = document.getElementById("feedbackText").value;
                    const feedbackStatus = document.getElementById("feedbackStatus");

                    if (containsOffensiveWords(feedbackText)) {
                        feedbackStatus.textContent = "Por favor, evite usar linguagem ofensiva.";
                        feedbackStatus.style.color = "red";
                        return;
                    }

                    db.collection("feedback")
                        .add({
                            name: name,
                            rating: parseInt(rating),
                            text: feedbackText,
                            timestamp: firebase.firestore.FieldValue.serverTimestamp()
                        })
                        .then(() => {
                            feedbackStatus.textContent = "Feedback enviado com sucesso!";
                            feedbackStatus.style.color = "green";
                            document.getElementById("feedbackName").value = "";
                            document.getElementById("feedbackText").value = "";
                            feedbackRating.value = "";
                            ratingStars.forEach((s) => s.classList.remove("active"));
                        })
                        .catch((error) => {
                            feedbackStatus.textContent = "Erro ao enviar feedback. Tente novamente.";
                            feedbackStatus.style.color = "red";
                        });
                });
            });

            function startQueueStatusCheck() {
                setInterval(() => {
                    checkQueueStatus().then((isActive) => {
                        const queueForm = document.getElementById("queueForm");
                        const queueStatusMessage =
                            document.getElementById("queueStatusMessage") || document.createElement("p");
                        queueStatusMessage.id = "queueStatusMessage";

                        if (!isActive) {
                            queueForm.style.display = "none";
                            queueStatusMessage.textContent =
                                "A fila ainda não está disponível. Há lugares vagos no bar.";
                            queueStatusMessage.style.color = "var(--primary-color)";
                            queueStatusMessage.style.fontWeight = "bold";
                            if (!document.getElementById("queueStatusMessage")) {
                                document.getElementById("fila").insertBefore(queueStatusMessage, queueForm);
                            }
                        } else {
                            queueForm.style.display = "block";
                            if (document.getElementById("queueStatusMessage")) {
                                document.getElementById("queueStatusMessage").remove();
                            }
                        }
                    });
                }, 60000);
            }

            const offensiveWords = ["palavrao1", "palavrao2", "palavrao3"];

            function containsOffensiveWords(text) {
                return offensiveWords.some((word) => text.toLowerCase().includes(word));
            }