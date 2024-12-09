// The server code
// const express = require("express");
// const path = require("path");
// const session = require("express-session");

// const app = express();
// const port = process.env.PORT || 5511;

// // Knex configuration for PostgreSQL
// const knex = require("knex")({
//     client: "pg",
//     connection: {
//         host: process.env.RDS_HOSTNAME || "localhost",
//         user: process.env.RDS_USERNAME || "postgres",
//         password: process.env.RDS_PASSWORD || "sigr2of3", // Replace with your actual password
//         database: process.env.RDS_DB_NAME || "INTEX_local",
//         port: process.env.RDS_PORT || 5432,
//         ssl: process.env.DB_SSL ? {rejectUnauthorized: false} : false
//     },
//     pool: {
//         min: 2, // Adjust based on load
//         max: 10, // Adjust based on DB limits
//       },
// });

const express = require("express");
const path = require("path");
const session = require("express-session");

const app = express();
const port = 5500;

// Knex configuration for PostgreSQL
const knex = require("knex")({
    client: "pg",
    connection: {
        host: "localhost",
        user: "postgres",
        password: "bradenPOST2644$", // Replace with your actual password
        database: "INTEX_local",
        port: 5432,
    },
});

// Utility function to capitalize the first letter of each word
function capitalizeWords(str) {
    if (!str) return ''; // Handle null or undefined
    return str
        .toLowerCase()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

// Set EJS as the view engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Middleware for handling form data
app.use(express.urlencoded({ extended: true }));


// Serve static files (e.g., images) from the IMG directory
app.use('/IMG', express.static('IMG'));



// LOGIN Session middleware configuration
app.use(session({
    secret: 'secretKey', // Secret key for session
    resave: false,
    saveUninitialized: true,
}));

// XXXXXXXXXXXXX NEW MIDDLEWARE
app.use((req, res, next) => {
    res.locals.user = req.session.user || null; // Set user in locals for all templates
    console.log("Current User:", res.locals.user); // Debug to check user data
    next();
});


// Middleware to protect routes
function isAuthenticated(req, res, next) {
    if (req.session.user) {
        return next(); // User is authenticated
    }
    res.redirect('/loginpage'); // Redirect to login page
}

// Apply isAuthenticated middleware to admin routes
app.use(['/adminhomepage', '/admin-volunteers', '/admin-event-requests', '/admin-upcoming-events', '/admin-past-events', '/admin-users'], isAuthenticated);


// HOME ROUTE
app.get('/', (req, res) => {
    // Fetch totals for completed vests, volunteer hours, and participants
    const vestPromise = knex('past_events').sum('num_complete_vests as totalVests');
    const hoursPromise = knex('past_events')
        .sum(knex.raw('actual_duration * num_participants'))
        .then(result => result[0].sum || 0);  // Extracting the sum directly from the result
    const participantsPromise = knex('past_events').sum('num_participants as totalParticipants');
 
    // Wait for all the promises to resolve
    Promise.all([vestPromise, hoursPromise, participantsPromise])
        .then(([vests, hours, participants]) => {
            const totalVests = vests[0].totalVests || 0;
            const totalHours = (parseFloat(hours) || 0).toFixed(1);  // Ensure hours is treated as a number
            const totalParticipants = participants[0].totalParticipants || 0;
 
            // Render the index page with the totals
            res.render('index', {
                totalVests,
                totalHours,
                totalParticipants
            });
        })
        .catch(error => {
            console.error('Error fetching totals:', error);
            res.status(500).send('Internal Server Error');
        });
});


// LOGIN ROUTE
app.get('/loginpage', (req, res) => {
    res.render('login'); // Render login.ejs from the views folder
});

// LOGIN ROUTE (POST request)
app.post('/loginpage', (req, res) => {
    const { username, password } = req.body;

    knex('users')
        .where({ username })
        .andWhere({ password })
        .first()
        .then(user => {
            if (user) {
                req.session.user = user; // Save user in session
                res.redirect('/'); // Redirect to home after successful login
            } else {
                res.render('login', { error: "Invalid username or password" });
            }
        })
        .catch(err => {
            console.error(err);
            res.status(500).send('Internal Server Error');
        });
});


 
// LOGOUT ROUTE
app.post('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).send('Failed to log out');
        }
        res.redirect('/'); // Redirect to home page after logout
    });
});




// DONATE ROUTE
app.get('/donate', (req, res) => {
    res.redirect('https://turtleshelterproject.org/checkout/donate?donatePageId=5b6a44c588251b72932df5a0');
});

// REQUEST EVENT ROUTE
app.get('/request-event', (req, res) => {
    res.render('eventRequest'); // Render eventRequest.ejs from the views folder
});

// ADMIN PAGE ROUTE
// app.get('/adminhomepage', (req, res) => {
//     if (!req.session.user) {
//         return res.redirect('/loginpage'); // Redirect to login page if user is not logged in
//     }
// });
app.get('/adminhomepage', isAuthenticated, (req, res) => {
    // Fetch users data from the database
    knex('users')
        .select('staff_id', 'username', 'emp_email', 'emp_first', 'emp_last', 'admin_priv')
        .then(users => {
            // Render the admin page with the fetched user data
            res.render('admin', { users });
        })
        .catch(error => {
            console.error('Error fetching data:', error);
            res.status(500).send('Internal Server Error');
        });
});


// GO TO ANALYTICS PAGE
app.get('/adminAnalytics', (req, res) => {
    res.render('admin-event-analytics'); // Render afrom the views folder
});


// VOLENTEER ROUTES ----------------------------------------

app.get('/admin-volunteers', (req, res) => {
    knex('volunteers')
        .select()
        .then(volunteers => {
            res.render('admin-volunteers', { volunteers });
        })
        .catch(error => {
            console.error('Error querying database:', error);
            res.status(500).send('Internal Server Error');
        });
});

// ADD VOLUNTEER GET ROUTE
app.get('/volunteer-signup', (req, res) => {
    res.render('addVolunteer'); // Render the form regardless of login status
});



// ADD VOLUNTEER POST ROUTE
app.post('/addVolunteer', (req, res) => {
    console.log(req.body);
    const { VOL_FIRST, VOL_LAST, VOL_PHONE, VOL_EMAIL, pref_contact, how_heard, vol_city, vol_state, sewing_level, hours_month } = req.body;
    // Server-side validation (ensure no empty required fields)
    // if (!VOL_FIRST || !VOL_LAST || !VOL_PHONE || !VOL_EMAIL || !pref_contact || !sewing_level) {
    //     return res.status(400).send('All fields are required.');
    // }
    // Function to format phone number
    const formatPhoneForDatabase = (phone) => {
        // Remove non-digit characters and format as 000-000-0000
        return phone.replace(/\D/g, '').replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');
    };

    const capitalizeWords = str =>
        str
            .toLowerCase()
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');

    const formattedPhone = formatPhoneForDatabase(VOL_PHONE);

    // Insert volunteer data into the database
    knex('volunteers')
        .insert({
            vol_first: capitalizeWords(VOL_FIRST),
            vol_last: capitalizeWords(VOL_LAST),
            vol_phone: formattedPhone,
            vol_email: VOL_EMAIL.toLowerCase(),
            pref_contact: pref_contact.toUpperCase(),
            how_heard: how_heard,
            vol_city: capitalizeWords(vol_city),
            vol_state: vol_state,
            sewing_level: sewing_level,
            hours_month: hours_month
        })
        .then(() => {
            console.log('Volunteer added successfully');
            // Redirect based on login status
            if (req.session.user) {
                // If logged in, redirect to admin-volunteers
                res.redirect('/admin-volunteers');
            } else {
                // If not logged in, redirect to home page
                res.redirect('/');
            }
        })
        .catch((error) => {
            console.error('Error adding volunteer:', error);
            res.status(500).send('Internal Server Error');
        });
});

// DELETE VOLUNTEER
app.post('/deleteVolunteer/:id', (req, res) => {
    const volunteerId = req.params.id;

    knex('volunteers')
        .where('vol_id', volunteerId)
        .del()
        .then(() => {
            console.log(`Volunteer with ID ${volunteerId} deleted successfully`);
            res.redirect('/admin-volunteers'); // Redirect to admin page after deletion
        })
        .catch(error => {
            console.error('Error deleting volunteer:', error);
            res.status(500).send('Internal Server Error');
        });
});

// EDIT VOLUNTEER GET
app.get('/editVolunteer/:id', (req, res) => {
    const volunteerId = req.params.id;

    knex('volunteers')
        .where('vol_id', volunteerId)
        .first()
        .then(volunteer => {
            if (!volunteer) {
                return res.status(404).send('Volunteer not found');
            }
            const formatPhoneForEdit = phone => {
                const cleaned = phone.replace(/\D/g, ''); // Remove non-numeric characters
                if (cleaned.length === 10) {
                    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
                }
                return phone; // Return unformatted phone if not valid
            };

            volunteer.vol_phone = formatPhoneForEdit(volunteer.vol_phone);

            res.render('editVolunteer', { volunteer });

        })
        .catch(error => {
            console.error('Error fetching volunteer:', error);
            res.status(500).send('Internal Server Error');
        });
});

// EDIT VOLUNTEER POST
app.post('/editVolunteer/:id', (req, res) => {
    const volunteerId = req.params.id;
    // Helper function to capitalize first letter of each word
    const capitalize = str => str
        .toLowerCase()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');

    // Helper function to format phone number for saving
    const formatPhoneForSave = phone => {
        const cleaned = phone.replace(/\D/g, ''); // Remove non-numeric characters
        if (cleaned.length === 10) {
            return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
        }
        throw new Error('Invalid phone number format');
    };

    // Prepare updated data
    const updatedData = {
        vol_first: capitalize(req.body.VOL_FIRST),
        vol_last: capitalize(req.body.VOL_LAST),
        vol_phone: formatPhoneForSave(req.body.VOL_PHONE), // Format phone number
        vol_email: req.body.VOL_EMAIL.toLowerCase(), // Ensure email is lowercase
        pref_contact: req.body.pref_contact,
        how_heard: capitalize(req.body.how_heard),
        vol_city: capitalize(req.body.vol_city),
        vol_state: req.body.vol_state.toUpperCase(),
        sewing_level: capitalize(req.body.sewing_level),
        hours_month: parseInt(req.body.hours_month, 10), // Convert to integer
    };

    knex('volunteers')
        .where('vol_id', volunteerId)
        .update(updatedData)
        .then(() => {
            console.log(`Volunteer with ID ${volunteerId} updated successfully`);
            res.redirect('/admin-volunteers');
        })
        .catch(error => {
            console.error('Error updating volunteer:', error);
            res.status(500).send('Internal Server Error');
        });
});









//REQUESTED EVENTS STUFFF
// requested Events
app.get('/admin-event-requests', (req, res) => {
    knex('event_requests')
        .select()
        .orderByRaw(`
            CASE 
                WHEN status = 'Pending' THEN 1 
                WHEN status = 'Approved' THEN 2 
                WHEN status = 'Completed' THEN 3 
                WHEN status = 'Denied' THEN 4 
            END
        `)
        .then(eventRequests => {
            res.render('admin-event-requests', { eventRequests });
        })
        .catch(error => {
            console.error('Error querying database:', error);
            res.status(500).send('Internal Server Error');
        });
});

//DENY EVENT
app.post('/denyEvent/:id', (req, res) => {
    const eventId = req.params.id;
 
    knex('event_requests')
        .where({ event_id: eventId })
        .update({ status: 'Denied' })
        .then(() => {
            console.log(`Event with ID ${eventId} has been denied.`);
            res.status(200).send('Event denied successfully');
        })
        .catch(error => {
            console.error('Error denying event:', error);
            res.status(500).send('Failed to deny event');
        });
});

//DELETE EVENT
// ALTER TABLE upcoming_events
// DROP CONSTRAINT fk_event_id,
// ADD CONSTRAINT fk_event_id FOREIGN KEY (event_id) REFERENCES event_requests(event_id) ON DELETE CASCADE;


// ALTER TABLE past_events
// DROP CONSTRAINT fk_event_id,
// ADD CONSTRAINT fk_event_id FOREIGN KEY (event_id) REFERENCES event_requests(event_id) ON DELETE CASCADE;
app.delete('/deleteEvent/:id', (req, res) => {
    const eventId = req.params.id;

    knex.transaction(trx => {
        // First, delete from event_requests
        return trx('event_requests')
            .where({ event_id: eventId })
            .del()
            .then(deletedCount => {
                if (deletedCount > 0) {
                    console.log('Deleted from event_requests');
                }

                // Then, delete from past_events
                return trx('past_events')
                    .where({ event_id: eventId })
                    .del();
            })
            .then(deletedCount => {
                if (deletedCount > 0) {
                    console.log('Deleted from past_events');
                }

                // Finally, delete from upcoming_events
                return trx('upcoming_events')
                    .where({ event_id: eventId })
                    .del();
            });
    })
    .then(() => res.status(200).send("Event deleted successfully from all tables."))
    .catch(err => {
        console.error("Error deleting event:", err);
        res.status(500).send("Failed to delete the event.");
    });
});

// add requested event
app.post('/addevents', (req, res) => {
    // Extract form values from req.body
    // Contact Information
    const organizationName = req.body.organization;
    const contactFirst = req.body.contactFirstName;
    const contactLast = req.body.contactLastName;
    const contactPhone = req.body.contactPhone;
    const contactEmail = req.body.contactEmail;

    // Function to format phone number
    const formatPhoneForDatabase = (phone) => {
        // Remove non-digit characters and format as 000-000-0000
        return phone.replace(/\D/g, '').replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');
    };

    const formattedPhone = formatPhoneForDatabase(contactPhone);

    // Event Information
    const eventAddress1 = req.body.address1;
    const eventAddress2 = req.body.address2;
    const eventCity = req.body.city;
    const eventState = req.body.state;
    const eventPostal = req.body.postalCode;

    // Event Date Info
    const eventPrefDate1 = req.body.date1;
    const eventPrefDate2 = req.body.date2;
    const eventPrefDate3 = req.body.date3;
    const eventType = req.body.activity;
    const eventEstNumPeople = parseInt(req.body.attendees);
    const eventStartTime = req.body.startTime;
    const eventDuration = parseFloat(req.body.duration);

    // Insert data into the database using Knex
    knex('event_requests')
        .insert({
            organization: capitalizeWords(organizationName), // Ensure organization name is uppercase
            contact_first_name: capitalizeWords(contactFirst), // Capitalize each word
            contact_last_name: capitalizeWords(contactLast), // Capitalize each word
            contact_phone: formattedPhone, // Keep as provided, assuming validation is done
            contact_email: contactEmail.toLowerCase(), // Store email in lowercase
            address1: capitalizeWords(eventAddress1), // Ensure address1 is uppercase
            address2: eventAddress2 ? capitalizeWords(eventAddress2) : null, // Uppercase if provided, otherwise null
            city: capitalizeWords(eventCity), // Ensure city is uppercase
            state: eventState.toUpperCase(), // Ensure state abbreviation is uppercase
            zip: eventPostal, // Keep as provided
            preferred_date_1: eventPrefDate1, // Keep as provided (date)
            preferred_date_2: eventPrefDate2 || null, // Use provided date or set as null
            preferred_date_3: eventPrefDate3 || null, // Use provided date or set as null
            event_type: eventType, // Assuming validation for allowed values ('Sewing', 'Non-sewing', 'Both') is done elsewhere
            est_people: eventEstNumPeople, // Keep as provided (integer)
            desired_duration: eventDuration, // Keep as provided (float)
            desired_time: eventStartTime, // Keep as provided (time format)
            status: "Pending"
        })
        .then(() => {
            console.log('Event added successfully');
            // Redirect based on user session
            if (req.session.user) {
                // If logged in, redirect to admin-event-requests
                res.redirect('/admin-event-requests');
            } else {
                // If not logged in, redirect to home page
                res.redirect('/');
            }
        })
        .catch(error => {
            console.error('Error inserting data:', error);
        });

});

// POST Events approved
app.post('/approveEvent/:id', (req, res) => {
    const eventId = req.params.id;
    const { plannedDate, plannedTime, plannedDuration } = req.body;

    if (!plannedDate || !plannedTime || !plannedDuration) {
        return res.status(400).send('All fields are required.');
    }

    knex.transaction(trx => {
        return trx('event_requests')
            .where({ event_id: eventId })
            .update({ status: 'Approved' })
            .then(() => {
                return trx('event_requests')
                    .where({ event_id: eventId })
                    .first();
            })
            .then(event => {
                if (!event) {
                    throw new Error('Event not found');
                }
                return trx('upcoming_events').insert({
                    organization: event.organization,
                    planned_date: plannedDate,
                    planned_time: plannedTime,
                    planned_duration: plannedDuration,
                    event_id: eventId,
                });
            });
    })
        .then(() => {
            console.log(`Event ${eventId} approved and added to upcoming events.`);
            res.redirect('/admin-upcoming-events');
        })
        .catch(error => {
            console.error('Error approving event:', error);
            res.status(500).send('Internal Server Error');
        });
});






//UPCOMING EVENTS
app.get('/admin-upcoming-events', (req, res) => {
    knex('upcoming_events') // Fetch upcoming events and join with event_requests
        .join('event_requests', 'upcoming_events.event_id', 'event_requests.event_id')
        .select(
            'event_requests.status',
            'upcoming_events.upcoming_event_id',
            'upcoming_events.event_id',
            'upcoming_events.organization',
            'upcoming_events.planned_date',
            'upcoming_events.planned_time',
            'upcoming_events.planned_duration',
            knex.raw("CONCAT(event_requests.contact_first_name, ' ', event_requests.contact_last_name) AS contact_name"),
            'event_requests.contact_phone',
            'event_requests.contact_email',
            knex.raw("CONCAT(event_requests.address1, ' ', COALESCE(event_requests.address2, ''), ', ', event_requests.city, ', ', event_requests.state, ' ', event_requests.zip) AS event_location"),
            'event_requests.event_type',
            'event_requests.est_people AS group_size'
        )
        .whereNot('event_requests.status', 'Completed')
        .orderBy([
            { column: 'upcoming_events.planned_date', order: 'asc' },
            { column: 'upcoming_events.planned_time', order: 'asc' }
        ]) // Select the upcoming events and the status from event_requests
        .then(upcomingEvents => {
            res.render('admin-upcoming-events', { upcomingEvents });
        })
        .catch(error => {
            console.error('Error querying database:', error);
            res.status(500).send('Internal Server Error');
        });
});

app.post('/completeTheEvent/:eventId', (req, res) => {
    console.log('POST /completeTheEvent route hit');

    // Capture the data from the form
    const { actualDate, actualTime, actualDuration, participants, pockets, collars, envelopes, incompleteVests, completeVests } = req.body;
    const eventId = req.params.eventId;

    // Validate the input data if necessary
    if (
        !actualDate || !actualTime || !actualDuration || !participants ||
        !pockets || !collars || !envelopes || !incompleteVests || !completeVests
    ) {
        return res.status(400).send('All fields are required.');
    }

    // Ensure the actual duration is in increments of 0.5 (as required)
    if (actualDuration % 0.5 !== 0) {
        return res.status(400).send('Duration must be in 0.5-hour increments.');
    }

    knex.transaction(trx => {
        console.log('Starting transaction...');

        // Update the event status to 'Completed'
        return trx('event_requests')
            .where({ event_id: eventId })
            .update({ status: 'Completed' })
            .then(() => {
                console.log('Status updated to Completed');

                // Fetch the event details
                return trx('event_requests')
                    .where({ event_id: eventId })
                    .first();
            })
            .then(event => {
                if (!event) {
                    console.log('Event not found');
                    throw new Error('Event not found');
                }

                // Extract organization from the event object
                const { organization } = event;

                // Insert into the past_events table
                return trx('past_events').insert({
                    organization: organization,
                    actual_date: actualDate,
                    actual_time: actualTime,
                    actual_duration: actualDuration,
                    num_participants: participants,
                    num_pockets: pockets,
                    num_collars: collars,
                    num_envelopes: envelopes,
                    num_complete_vests: completeVests,
                    num_incomplete_vests: incompleteVests,
                    event_id: eventId
                });
            });
    })
        .then(() => {
            console.log(`Event ${eventId} completed and added to past events.`);
            res.redirect('/admin-upcoming-events');
        })
        .catch(error => {
            console.error('Error completing event:', error);
            res.status(500).send('Internal Server Error');
        });
});

// Render the edit form for an upcoming event
app.get('/editUpcomingEvent/:id', (req, res) => {
    const eventId = req.params.id;

    if (!eventId) {
        return res.status(400).send('Event ID is required.');
    }

    knex('upcoming_events')
        .join('event_requests', 'upcoming_events.event_id', 'event_requests.event_id')
        .select(
            'event_requests.event_id', // Ensure event_id is included
            'upcoming_events.upcoming_event_id',
            'upcoming_events.organization',
            'upcoming_events.planned_date',
            'upcoming_events.planned_time',
            'upcoming_events.planned_duration',
            'event_requests.contact_first_name',
            'event_requests.contact_last_name',
            'event_requests.contact_phone',
            'event_requests.contact_email',
            'event_requests.address1',
            'event_requests.address2',
            'event_requests.city',
            'event_requests.state',
            'event_requests.zip AS postal_code', // Use consistent alias
            'event_requests.event_type',
            'event_requests.est_people AS group_size'
        )
        .where('upcoming_events.event_id', eventId)
        .first()
        .then(event => {
            if (!event) {
                return res.status(404).send('Event not found');
            }
            console.log('Event Data for Edit Form:', event); // Debugging step
            res.render('editUpcomingEvent', { event });
        })
        .catch(error => {
            console.error('Error fetching event:', error);
            res.status(500).send('Internal Server Error');
        });
});



app.post('/editUpcomingEvent/:id', (req, res) => {
    const eventId = req.params.id; // Extract the event ID from the URL

    // Helper function to capitalize the first letter of each word
    const capitalize = str => str
        .toLowerCase()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');

    // Helper function to format phone number for saving
    const formatPhoneForSave = phone => {
        const cleaned = phone.replace(/\D/g, ''); // Remove non-numeric characters
        if (cleaned.length === 10) {
            return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
        }
        throw new Error('Invalid phone number format');
    };

    // Destructure and prepare updated data
    const {
        organization,
        contactFirstName,
        contactLastName,
        contactPhone,
        contactEmail,
        address1,
        address2,
        city,
        state,
        postalCode,
        eventType,
        groupSize,
        plannedDate,
        plannedTime,
        plannedDuration
    } = req.body;

    // Prepare data for `event_requests` table
    const eventData = {
        organization: capitalize(organization), // Capitalize organization name
        contact_first_name: capitalize(contactFirstName), // Capitalize first name
        contact_last_name: capitalize(contactLastName), // Capitalize last name
        contact_phone: formatPhoneForSave(contactPhone), // Format phone number
        contact_email: contactEmail.toLowerCase(), // Ensure email is lowercase
        address1: capitalize(address1), // Capitalize address line 1
        address2: address2 ? capitalize(address2) : null, // Capitalize address line 2, or null if empty
        city: capitalize(city), // Capitalize city name
        state: state.toUpperCase(), // Ensure state abbreviation is uppercase
        zip: postalCode, // No additional formatting for postal code
        event_type: eventType, // Assuming validation for allowed values is done elsewhere
        est_people: parseInt(groupSize, 10), // Convert to integer
    };

    // Prepare data for `upcoming_events` table
    const upcomingEventData = {
        organization: capitalize(organization), // Ensure organization is capitalized here
        planned_date: plannedDate, // Keep date as provided
        planned_time: plannedTime, // Keep time as provided
        planned_duration: parseFloat(plannedDuration), // Convert duration to float
    };

    // Use Knex transaction to update both tables
    knex.transaction(trx => {
        return trx('event_requests')
            .where({ event_id: eventId })
            .update(eventData)
            .then(() => {
                return trx('upcoming_events')
                    .where({ event_id: eventId })
                    .update(upcomingEventData);
            });
    })
        .then(() => {
            console.log('Event updated successfully');
            res.redirect('/admin-upcoming-events');
        })
        .catch(error => {
            console.error('Error updating event:', error);
            res.status(500).send('Internal Server Error');
        });
});





//PAST EVENTS ---------------------------------
app.get('/admin-past-events', (req, res) => {
    knex('past_events')
        .join('event_requests', 'past_events.event_id', '=', 'event_requests.event_id')
        .select('past_events.*', 'event_requests.status', 'event_requests.address1', 'event_requests.city', 'event_requests.state') // Select the upcoming events and the status from event_requests
        .orderBy('past_events.actual_date', 'desc')
        .then(pastEvents => {
            res.render('admin-past-events', { pastEvents });
        })
        .catch(error => {
            console.error('Error querying database:', error);
            res.status(500).send('Internal Server Error');
        });
});

// Get route for past events edit
app.get('/editPastEvent/:id', (req, res) => {
    const pastEventId = req.params.id;
 
    knex('past_events')
        .join('event_requests', 'past_events.event_id', '=', 'event_requests.event_id')
        .select(
            'past_events.past_event_id',
            'past_events.organization',
            'past_events.actual_date',
            'past_events.actual_time',
            'past_events.actual_duration',
            'past_events.num_participants',
            'past_events.num_pockets',
            'past_events.num_collars',
            'past_events.num_envelopes',
            'past_events.num_complete_vests',
            'past_events.num_incomplete_vests',
            'event_requests.address1',
            'event_requests.address2',
            'event_requests.city',
            'event_requests.state',
            'event_requests.zip'
        )
        .where('past_events.past_event_id', pastEventId)
        .first()
        .then(event => {
            if (!event) {
                return res.status(404).send('Past event not found');
            }
            res.render('editPastEvent', { event });
        })
        .catch(error => {
            console.error('Error fetching past event:', error);
            res.status(500).send('Internal Server Error');
        });
});
 
/// Post route for past events route XXXXX
app.post('/editPastEvent/:id', (req, res) => {
    const pastEventId = req.params.id;
    const {
        organization,
        actual_date,
        actual_time,
        actual_duration,
        num_participants,
        num_pockets,
        num_collars,
        num_envelopes,
        num_complete_vests,
        num_incomplete_vests,
        address1,
        address2,
        city,
        state,
        zip
    } = req.body;
 
    // Start a transaction to ensure consistency
    knex.transaction(trx => {
        // Update the past_events table
        return trx('past_events')
            .where({ past_event_id: pastEventId })
            .update({
                organization,
                actual_date,
                actual_time,
                actual_duration,
                num_participants,
                num_pockets,
                num_collars,
                num_envelopes,
                num_complete_vests,
                num_incomplete_vests,
            })
            .then(() => {
                // Fetch the event_id from the past_events table
                return trx('past_events')
                    .where({ past_event_id: pastEventId })
                    .select('event_id')
                    .first();
            })
            .then(({ event_id }) => {
                // Update the event_requests table
                return trx('event_requests')
                    .where({ event_id })
                    .update({
                        address1,
                        address2,
                        city,
                        state,
                        zip
                    });
            });
    })
        .then(() => {
            console.log('Past event and related data updated successfully');
            res.redirect('/admin-past-events');
        })
        .catch(error => {
            console.error('Error updating past event:', error);
            res.status(500).send('Internal Server Error');
        });
});







//USERS
app.get('/admin-users', (req, res) => {
    knex('users')
        .select()
        .then(staffMembers => {
            res.render('admin-users', { staffMembers });
        })
        .catch(error => {
            console.error('Error querying database:', error);
            res.status(500).send('Internal Server Error');
        });
});

// ADD USER GET PULL UP ADD PAGE
app.get('/addUser', (req, res) => {
    res.render('addUser');
});

// ADD USER POST
app.post('/addUser', (req, res) => {
    // Extract form values from req.body
    const username = req.body.USERNAME
    const password = req.body.PASSWORD
    const empEmail = req.body.EMP_EMAIL
    const firstName = req.body.EMP_FIRST
    const lastName = req.body.EMP_LAST
    const adminPriv = req.body.ADMIN_PRIV
    knex('users')
        .insert({
            username: username,
            password: password,
            emp_email: empEmail,
            emp_first: capitalizeWords(firstName),
            emp_last: capitalizeWords(lastName),
            admin_priv: adminPriv,
        })
        .then(() => {
            res.redirect('/admin-users');
        })
        .catch(error => {
            console.error('Error adding staff:', error);
            res.status(500).send('Internal Server Error');
        });
});

// EDIT USER
app.get('/editUser/:id', (req, res) => {
    const staffID = req.params.id;

    knex('users')
        .where('staff_id', staffID)
        .first()
        .then(staff => {
            if (!staff) {
                return res.status(404).send('User not found');
            }

            res.render('editUser', { staff });
        })
        .catch(error => {
            console.error('Error fetching user:', error);
            res.status(500).send('Internal Server Error');
        });
});

app.post('/editUser/:id', (req, res) => {
    const staffID = req.params.id;

    // Helper function to capitalize the first letter of each word
    const capitalize = str => str
        .toLowerCase()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');

    const { USERNAME, PASSWORD, EMP_EMAIL, EMP_FIRST, EMP_LAST, ADMIN_PRIV } = req.body;

    knex('users')
        .where('staff_id', staffID)
        .update({
            username: USERNAME, // No formatting applied
            password: PASSWORD, // No formatting applied (should be hashed securely in practice)
            emp_email: EMP_EMAIL.toLowerCase(), // Ensure email is stored in lowercase
            emp_first: capitalize(EMP_FIRST), // Capitalize first name
            emp_last: capitalize(EMP_LAST), // Capitalize last name
            admin_priv: ADMIN_PRIV || 'N', // Default to 'N' if no value is provided
        })
        .then((rowsAffected) => {
            if (rowsAffected === 0) {
                console.error('No record updated. staffID may not exist.');
                return res.status(404).send('User not found.');
            }
            res.redirect('/admin-users'); // Redirect to the list of users
        })
        .catch((error) => {
            console.error('Error updating user:', error);
            res.status(500).send('Internal Server Error');
        });
});


//Remove USER
app.post('/removeUser/:id', (req, res) => {
    const staffID = req.params.id;

    knex('users')
        .where('staff_id', staffID)
        .del()
        .then(() => {
            console.log(`Staff with ID ${staffID} deleted successfully`);
            res.redirect('/admin-users'); // Redirect to admin page after deletion
        })
        .catch(error => {
            console.error('Error deleting staff member:', error);
            res.status(500).send('Internal Server Error');
        });
});





// ABOUT US ROUTE
app.get('/about', (req, res) => {
    res.render('about'); // Render about.ejs from the views folder
});

// Start the server
app.listen(port, () => {
    console.log(`Listening my DUDE on http://localhost:${port}`);
});