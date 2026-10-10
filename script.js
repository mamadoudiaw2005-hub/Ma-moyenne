document.addEventListener('DOMContentLoaded', () => {
    // ============================================================
    // SÉCURITÉ : Fonctions de protection contre les attaques XSS
    // ============================================================

    // Fonction qui nettoie tout texte entré par l'utilisateur.
    // Elle remplace les caractères dangereux (<, >, &, ", ')
    // qui pourraient être utilisés pour injecter du code malveillant.
    function sanitize(str) {
        const div = document.createElement('div');
        div.appendChild(document.createTextNode(str));
        return div.innerHTML;
    }

    // Fonction qui valide qu'une note est bien un nombre entre 0 et 20
    function isValidGrade(value) {
        const num = parseFloat(value);
        return !isNaN(num) && num >= 0 && num <= 20;
    }

    // Fonction qui valide qu'un coefficient est bien un nombre positif
    function isValidCoeff(value) {
        const num = parseFloat(value);
        return !isNaN(num) && num > 0;
    }

    // Fonction qui valide qu'un nom de matière ne contient pas de code HTML/JS
    function isValidName(str) {
        // Bloque tout ce qui ressemble à du HTML ou JavaScript
        const forbidden = /<[^>]*>|javascript:|on\w+\s*=|<script|<\/script|alert\(|eval\(|document\.|window\./i;
        return str.length > 0 && str.length <= 100 && !forbidden.test(str);
    }

    const tabConfig = document.getElementById('tab-config');
    const tabGrades = document.getElementById('tab-grades');
    const viewConfig = document.getElementById('view-config');
    const viewGrades = document.getElementById('view-grades');
    
    const subjectForm = document.getElementById('subject-config-form');
    const subjectsList = document.getElementById('configured-subjects-list');
    const noSubjectsMsg = document.getElementById('no-subjects-msg');
    const goToGradesBtn = document.getElementById('go-to-grades-btn');
    
    const gradesContainer = document.getElementById('grades-cards-container');
    const summaryCard = document.getElementById('summary-card');
    
    const resetAppBtn = document.getElementById('reset-app-btn');

    // Génération d'un ID unique
    window.generateId = function() {
        return Math.random().toString(36).substr(2, 9);
    };
    
    let storedData = JSON.parse(localStorage.getItem('gradesApp_data_v2'));
    let allData;
    
    if (storedData) {
        allData = storedData;
    } else {
        // Migration logic depuis la V1
        let storedSubjects = JSON.parse(localStorage.getItem('gradesApp_subjects')) || [];
        let migratedSubjects = storedSubjects.map(s => {
            if (s.evaluations !== undefined) return s; 
            
            let evals = [];
            let devCount = 1;
            if (s.devoir1 !== null && s.devoir1 !== undefined) evals.push({ id: generateId(), type: 'devoir', note: s.devoir1, label: 'Devoir ' + devCount++ });
            if (s.devoir2 !== null && s.devoir2 !== undefined) evals.push({ id: generateId(), type: 'devoir', note: s.devoir2, label: 'Devoir ' + devCount++ });
            if (s.compo !== null && s.compo !== undefined) evals.push({ id: generateId(), type: 'compo', note: s.compo, label: 'Examen/Composition' });
            
            return {
                id: s.id,
                name: s.name,
                coeff: s.coeff,
                evaluations: evals
            };
        });
        
        allData = {
            'S1': migratedSubjects,
            'S2': JSON.parse(JSON.stringify(migratedSubjects)) // Copier les matières pour le S2 par défaut (sans les notes)
        };
        
        // Vider les notes pour le S2 copié
        allData['S2'].forEach(sub => {
            sub.evaluations.forEach(ev => ev.note = null);
        });
        
        localStorage.setItem('gradesApp_data_v2', JSON.stringify(allData));
    }

    let currentSemester = 'S1';
    let subjects = allData[currentSemester];
    
    const semesterSelect = document.getElementById('semester-select');
    if (semesterSelect) {
        semesterSelect.addEventListener('change', (e) => {
            currentSemester = e.target.value;
            subjects = allData[currentSemester];
            renderConfigView();
            if(!viewGrades.classList.contains('hidden')) {
                renderGradesView();
            }
        });
    }

    // --- 0. RÉINITIALISATION GLOBALE ---
    resetAppBtn.addEventListener('click', () => {
        if (confirm("⚠️ ATTENTION : Êtes-vous sûr de vouloir effacer tout l'historique ?\n\nToutes vos matières et toutes vos notes seront définitivement perdues. C'est idéal pour recommencer une nouvelle année.")) {
            allData = { 'S1': [], 'S2': [] };
            subjects = allData[currentSemester];
            saveData();
            renderConfigView();
            renderGradesView();
            switchTab('config');
            alert("L'historique a été effacé avec succès.");
        }
    });

    // --- NAVIGATION ---
    tabConfig.addEventListener('click', () => switchTab('config'));
    tabGrades.addEventListener('click', () => switchTab('grades'));
    goToGradesBtn.addEventListener('click', () => switchTab('grades'));

    function switchTab(tab) {
        if (tab === 'config') {
            tabConfig.classList.add('active');
            tabGrades.classList.remove('active');
            viewConfig.classList.remove('hidden');
            viewGrades.classList.add('hidden');
        } else {
            tabConfig.classList.remove('active');
            tabGrades.classList.add('active');
            viewConfig.classList.add('hidden');
            viewGrades.classList.remove('hidden');
            renderGradesView(); 
        }
    }

    // --- VUE 1 : CONFIGURATION ---
    subjectForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const nameInput = document.getElementById('subject-name');
        const coeffInput = document.getElementById('subject-coeff');
        
        const name = nameInput.value.trim();
        const coeff = parseFloat(coeffInput.value);

        // SÉCURITÉ : Validation du nom de matière
        if (!isValidName(name)) {
            alert("⚠️ Nom invalide !\n\nLe nom de la matière ne peut pas contenir de code ou de caractères spéciaux dangereux.\nMaximum 100 caractères.");
            nameInput.value = '';
            nameInput.focus();
            return;
        }

        // SÉCURITÉ : Validation du coefficient
        if (!isValidCoeff(coeff)) {
            alert("⚠️ Coefficient invalide !\n\nLe coefficient doit être un nombre positif.");
            coeffInput.value = '';
            coeffInput.focus();
            return;
        }

        if (name && !isNaN(coeff)) {
            // Fonction de normalisation : retire les accents, espaces multiples, met en minuscule
            function normalize(str) {
                return str.toLowerCase()
                    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Retire les accents
                    .replace(/\s+/g, " ")  // Réduit les espaces multiples
                    .trim();
            }

            const normalizedNew = normalize(name);

            // Vérification des doublons : nom exact OU nom très similaire (l'un contient l'autre)
            const duplicate = subjects.find(s => {
                const normalizedExisting = normalize(s.name);
                return normalizedExisting === normalizedNew ||
                       normalizedExisting.includes(normalizedNew) ||
                       normalizedNew.includes(normalizedExisting);
            });

            if (duplicate) {
                alert("⚠️ Doublon détecté !\n\nLa matière \"" + name + "\" ressemble trop à \"" + duplicate.name + "\" qui existe déjà.\n\nVeuillez utiliser un nom différent pour éviter les confusions.");
                nameInput.value = '';
                nameInput.focus();
                return;
            }

            const newSubject = {
                id: generateId(),
                name: name,
                coeff: coeff,
                evaluations: [] 
            };
            
            subjects.push(newSubject);
            saveData();
            renderConfigView();
            
            nameInput.value = '';
            coeffInput.value = '';
            nameInput.focus();
        }
    });

    window.deleteSubject = function(id) {
        if(confirm("Êtes-vous sûr de vouloir supprimer cette matière et toutes ses notes ?")) {
            subjects = subjects.filter(s => s.id !== id);
            saveData();
            renderConfigView();
            if(!viewGrades.classList.contains('hidden')) {
                renderGradesView(); 
            }
        }
    };

    function renderConfigView() {
        subjectsList.innerHTML = '';
        if (subjects.length === 0) {
            noSubjectsMsg.classList.remove('hidden');
            goToGradesBtn.classList.add('hidden');
        } else {
            noSubjectsMsg.classList.add('hidden');
            goToGradesBtn.classList.remove('hidden');
            
            subjects.forEach(sub => {
                const li = document.createElement('li');

                // SÉCURITÉ : On utilise textContent au lieu de innerHTML
                // pour les données entrées par l'utilisateur (empêche le XSS)
                const infoDiv = document.createElement('div');
                infoDiv.className = 'subject-info';

                const nameSpan = document.createElement('span');
                nameSpan.className = 'subject-title';
                nameSpan.textContent = sub.name; // textContent = sécurisé

                const coeffSpan = document.createElement('span');
                coeffSpan.className = 'subject-coef';
                coeffSpan.textContent = 'Coefficient : ' + sub.coeff; // textContent = sécurisé

                infoDiv.appendChild(nameSpan);
                infoDiv.appendChild(coeffSpan);

                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'btn-delete';
                deleteBtn.title = 'Supprimer';
                deleteBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
                deleteBtn.addEventListener('click', () => deleteSubject(sub.id));

                li.appendChild(infoDiv);
                li.appendChild(deleteBtn);
                subjectsList.appendChild(li);
            });
        }
    }

    // --- VUE 2 : SAISIE DES NOTES ---
    window.addEvaluation = function(subjectId, type) {
        const subjectIndex = subjects.findIndex(s => s.id === subjectId);
        if (subjectIndex !== -1) {
            let label = '';
            if (type === 'devoir') {
                const devCount = subjects[subjectIndex].evaluations.filter(e => e.type === 'devoir').length + 1;
                label = 'Devoir ' + devCount;
            } else {
                const compoCount = subjects[subjectIndex].evaluations.filter(e => e.type === 'compo').length + 1;
                label = compoCount > 1 ? 'Examen ' + compoCount : 'Examen / Compo';
            }
            
            subjects[subjectIndex].evaluations.push({
                id: generateId(),
                type: type,
                note: null,
                label: label
            });
            saveData();
            renderGradesView(); 
        }
    };

    window.removeEvaluation = function(subjectId, evalId) {
        const subjectIndex = subjects.findIndex(s => s.id === subjectId);
        if (subjectIndex !== -1) {
            subjects[subjectIndex].evaluations = subjects[subjectIndex].evaluations.filter(e => e.id !== evalId);
            
            // Renommer les devoirs pour garder la cohérence
            let dCount = 1;
            let cCount = 1;
            subjects[subjectIndex].evaluations.forEach(e => {
                if (e.type === 'devoir') e.label = 'Devoir ' + (dCount++);
                if (e.type === 'compo') {
                    e.label = cCount > 1 ? 'Examen ' + cCount : 'Examen / Compo';
                    cCount++;
                }
            });
            
            saveData();
            renderGradesView();
        }
    };

    function renderGradesView() {
        gradesContainer.innerHTML = '';
        
        if (subjects.length === 0) {
            gradesContainer.innerHTML = '<div class="empty-state" style="grid-column: 1/-1;"><p>Vous devez d\'abord ajouter vos matières dans l\'onglet "Mes Matières".</p></div>';
            summaryCard.classList.add('hidden');
            return;
        }
        
        subjects.forEach(sub => {
            const card = document.createElement('div');
            card.className = 'grade-card';
            
            const result = calculateSubjectAverage(sub);
            const displayMoyenne = result.moyenne !== null ? result.moyenne.toFixed(2) : '-';
            
            let evalsHtml = sub.evaluations.map(ev => `
                <div class="eval-row">
                    <div class="eval-input-group">
                        <label>${ev.label}</label>
                        <input type="number" class="grade-input" data-sub-id="${sub.id}" data-ev-id="${ev.id}" value="${ev.note !== null ? ev.note : ''}" min="0" max="20" step="0.25" placeholder="-">
                    </div>
                    <button class="btn-remove-eval" onclick="removeEvaluation('${sub.id}', '${ev.id}')" title="Supprimer cette évaluation"><i class="fa-solid fa-xmark"></i></button>
                </div>
            `).join('');

            // SÉCURITÉ : Construction de la carte sans mettre de données
            // utilisateur directement dans innerHTML
            
            // En-tête de la carte
            const cardHeader = document.createElement('div');
            cardHeader.className = 'grade-card-header';
            
            const titleSpan = document.createElement('span');
            titleSpan.className = 'grade-card-title';
            titleSpan.textContent = sub.name; // textContent = sécurisé
            
            const coefSpan = document.createElement('span');
            coefSpan.className = 'grade-card-coef';
            coefSpan.textContent = 'Coef: ' + sub.coeff; // textContent = sécurisé
            
            cardHeader.appendChild(titleSpan);
            cardHeader.appendChild(coefSpan);
            card.appendChild(cardHeader);

            // Conteneur des évaluations
            const evalsContainer = document.createElement('div');
            evalsContainer.className = 'evaluations-container';
            evalsContainer.id = 'evals-' + sub.id;

            if (sub.evaluations.length === 0) {
                const emptyMsg = document.createElement('p');
                emptyMsg.style.cssText = 'font-size:0.85rem; color:#6c757d; text-align:center; font-style:italic;';
                emptyMsg.textContent = 'Aucune évaluation. Ajoutez un devoir ou un examen.';
                evalsContainer.appendChild(emptyMsg);
            } else {
                sub.evaluations.forEach(ev => {
                    const evalRow = document.createElement('div');
                    evalRow.className = 'eval-row';

                    const inputGroup = document.createElement('div');
                    inputGroup.className = 'eval-input-group';

                    const lbl = document.createElement('label');
                    lbl.textContent = ev.label; // textContent = sécurisé

                    const inp = document.createElement('input');
                    inp.type = 'number';
                    inp.className = 'grade-input';
                    inp.setAttribute('data-sub-id', sub.id);
                    inp.setAttribute('data-ev-id', ev.id);
                    inp.min = '0';
                    inp.max = '20';
                    inp.step = '0.25';
                    inp.placeholder = '-';
                    if (ev.note !== null) inp.value = ev.note;

                    inputGroup.appendChild(lbl);
                    inputGroup.appendChild(inp);

                    const removeBtn = document.createElement('button');
                    removeBtn.className = 'btn-remove-eval';
                    removeBtn.title = 'Supprimer cette évaluation';
                    removeBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
                    removeBtn.addEventListener('click', () => removeEvaluation(sub.id, ev.id));

                    evalRow.appendChild(inputGroup);
                    evalRow.appendChild(removeBtn);
                    evalsContainer.appendChild(evalRow);
                });
            }
            card.appendChild(evalsContainer);

            // Boutons d'ajout
            const cardActions = document.createElement('div');
            cardActions.className = 'card-actions';

            const addDevoirBtn = document.createElement('button');
            addDevoirBtn.className = 'btn-add-eval devoir';
            addDevoirBtn.innerHTML = '<i class="fa-solid fa-plus"></i> Devoir';
            addDevoirBtn.addEventListener('click', () => addEvaluation(sub.id, 'devoir'));

            const addCompoBtn = document.createElement('button');
            addCompoBtn.className = 'btn-add-eval compo';
            addCompoBtn.innerHTML = '<i class="fa-solid fa-plus"></i> Examen';
            addCompoBtn.addEventListener('click', () => addEvaluation(sub.id, 'compo'));

            cardActions.appendChild(addDevoirBtn);
            cardActions.appendChild(addCompoBtn);
            card.appendChild(cardActions);

            // Résultat
            const gradeResult = document.createElement('div');
            gradeResult.className = 'grade-result';

            const resultLabel = document.createElement('span');
            resultLabel.textContent = 'Moyenne Matière';

            const resultValue = document.createElement('strong');
            resultValue.id = 'moyenne-' + sub.id;
            resultValue.textContent = displayMoyenne;

            gradeResult.appendChild(resultLabel);
            gradeResult.appendChild(resultValue);
            card.appendChild(gradeResult);

            gradesContainer.appendChild(card);
        });

        // Event listener pour les inputs
        document.querySelectorAll('.grade-input').forEach(input => {
            input.addEventListener('input', handleGradeInput);
        });

        updateGlobalSummary();
    }

    function handleGradeInput(e) {
        const subId = e.target.getAttribute('data-sub-id');
        const evId = e.target.getAttribute('data-ev-id');
        let valueStr = e.target.value;
        
        // Blocage de la note entre 0 et 20
        if (valueStr !== '') {
            let numVal = parseFloat(valueStr);
            if (numVal > 20) {
                numVal = 20;
                e.target.value = 20; // Force l'affichage à 20
            } else if (numVal < 0) {
                numVal = 0;
                e.target.value = 0; // Force l'affichage à 0
            }
            valueStr = numVal.toString();
        }
        
        const subjectIndex = subjects.findIndex(s => s.id === subId);
        if(subjectIndex !== -1) {
            const evalIndex = subjects[subjectIndex].evaluations.findIndex(ev => ev.id === evId);
            if(evalIndex !== -1) {
                subjects[subjectIndex].evaluations[evalIndex].note = valueStr === '' ? null : parseFloat(valueStr);
                saveData();
                
                const result = calculateSubjectAverage(subjects[subjectIndex]);
                document.getElementById(`moyenne-${subId}`).textContent = result.moyenne !== null ? result.moyenne.toFixed(2) : '-';
                
                updateGlobalSummary();
            }
        }
    }

    // --- LOGIQUE DE CALCUL MATHÉMATIQUE ---
    function calculateSubjectAverage(sub) {
        let devoirs = sub.evaluations.filter(e => e.type === 'devoir' && e.note !== null && !isNaN(e.note));
        let compos = sub.evaluations.filter(e => e.type === 'compo' && e.note !== null && !isNaN(e.note));

        let moyenneDevoirs = null;
        let moyenneCompos = null;

        if (devoirs.length > 0) {
            let sumDev = devoirs.reduce((sum, d) => sum + d.note, 0);
            moyenneDevoirs = sumDev / devoirs.length;
        }

        if (compos.length > 0) {
            let sumComp = compos.reduce((sum, c) => sum + c.note, 0);
            moyenneCompos = sumComp / compos.length; 
        }

        let moyenneMatiere = null;

        if (moyenneDevoirs !== null && moyenneCompos !== null) {
            // S'il y a les deux : (Moyenne devoirs + Examen) / 2
            moyenneMatiere = (moyenneDevoirs + moyenneCompos) / 2;
        } else if (moyenneDevoirs !== null) {
            // S'il n'y a que des devoirs
            moyenneMatiere = moyenneDevoirs;
        } else if (moyenneCompos !== null) {
            // S'il n'y a qu'un examen
            moyenneMatiere = moyenneCompos;
        }

        return {
            moyenne: moyenneMatiere,
            points: moyenneMatiere !== null ? moyenneMatiere * sub.coeff : 0
        };
    }

    function updateGlobalSummary() {
        let totalPoints = 0;
        let totalCoeffs = 0;
        let hasAtLeastOneGrade = false;

        subjects.forEach(sub => {
            const result = calculateSubjectAverage(sub);
            if (result.moyenne !== null) {
                totalPoints += result.points;
                totalCoeffs += sub.coeff;
                hasAtLeastOneGrade = true;
            }
        });

        if (!hasAtLeastOneGrade) {
            summaryCard.classList.add('hidden');
            return;
        }

        const globalAverage = totalPoints / totalCoeffs;

        document.getElementById('total-coeffs').textContent = totalCoeffs;
        document.getElementById('total-points').textContent = totalPoints.toFixed(2);
        document.getElementById('final-average').textContent = globalAverage.toFixed(2);

        const appreciationEl = document.getElementById('appreciation');
        appreciationEl.className = 'appreciation';
        
        if (globalAverage >= 18) {
            appreciationEl.textContent = "Excellent ! 🏆";
            appreciationEl.classList.add('excellent');
        } else if (globalAverage >= 16) {
            appreciationEl.textContent = "Très bien ! 🌟";
            appreciationEl.classList.add('excellent');
        } else if (globalAverage >= 14) {
            appreciationEl.textContent = "Bien ! 👍";
            appreciationEl.classList.add('good');
        } else if (globalAverage >= 12) {
            appreciationEl.textContent = "Assez bien.";
            appreciationEl.classList.add('good');
        } else if (globalAverage >= 10) {
            appreciationEl.textContent = "Passable.";
            appreciationEl.classList.add('average');
        } else {
            appreciationEl.textContent = "Insuffisant 📚";
            appreciationEl.classList.add('poor');
        }

        summaryCard.classList.remove('hidden');
    }

    function saveData() {
        allData[currentSemester] = subjects;
        localStorage.setItem('gradesApp_data_v2', JSON.stringify(allData));
    }

    renderConfigView();
});
