const express = require('express')
const path = require('path')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const {open} = require('sqlite')
const sqlite3 = require('sqlite3')
const app = express()
app.use(express.json())

const dbPath = path.join(__dirname, 'covid19IndiaPortal.db')

let db = null

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    })
    app.listen(3000, () => {
      console.log('Server Running at http://localhost:3000/')
    })
  } catch (e) {
    console.log(`DB Error: ${e.message}`)
    process.exit(1)
  }
}

initializeDBAndServer()

//authentication middleware function
const authenticateToken = (request, response, next) => {
  let jwtToken
  const authHeader = request.headers['authorization']
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(' ')[1]
  }
  if (jwtToken === undefined) {
    response.status(401)
    response.send('Invalid JWT Token')
  } else {
    jwt.verify(jwtToken, 'MY_SECRET', async (error, payload) => {
      if (error) {
        response.status(401)
        response.send('Invalid JWT Token')
      } else {
        next()
      }
    })
  }
}

//login api
app.post('/login/', async (request, response) => {
  const {username, password} = request.body
  const dbuserquery = `select * from user where username="${username}"`
  const dbuser = await db.get(dbuserquery)
  if (dbuser === undefined) {
    response.status(400)
    response.send('Invalid user')
  } else {
    const ispasswordmatched = await bcrypt.compare(password, dbuser.password)
    if (ispasswordmatched) {
      const payload = {username: username}
      let jwtToken = jwt.sign(payload, 'MY_SECRET')
      response.send({jwtToken})
    } else {
      response.send('Invalid password')
    }
  }
})

app.get('/states/', authenticateToken, async (request, response) => {
  const query = `select * from state `
  const result = await db.all(query)
  response.send(result)
})

app.get('/states/:stateId/', authenticateToken, async (request, response) => {
  const {stateId} = request.params
  const query = `select * from state where state_id="${stateId}"`
  const result = await db.get(query)
  response.send(result)
})

app.post('/districts/', authenticateToken, async (request, response) => {
  const {districtName, stateId, cases, cured, active, deaths} = request.body
  const query = `insert into district(district_name,state_id,cases,cured,active,deaths) values("${districtName}","${stateId}","${cases}","${cured}","${active}","${deaths}")`
  await db.run(query)
  response.send('District Succesfully Added')
})

app.get(
  '/districts/:districtId',
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params
    const query = `select * from district where district_id="${districtId}"`
    const result = await db.get(query)
    response.send(result)
  },
)

app.delete(
  '/districts/:districtId',
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params
    const query = `delete from district where district_id="${districtId}"`
    await db.run(query)
    response.send('District Removed')
  },
)

app.put(
  '/districts/:districtId',
  authenticateToken,
  async (request, response) => {
    const {districtName, stateId, cases, cured, active, deaths} = request.body
    const districtId = request.params
    const query = `update district set district_name="${districtName}",
  state_id="${stateId}",
  cases="${cases}",
  cured="${cured}",
  active="${active}",
  deaths="${deaths}" where district_id="${districtId}"`
    await db.run(query)
    response.send('Districts Details Updated')
  },
)

app.get(
  '/states/:stateId/stats',
  authenticateToken,
  async (request, response) => {
    const {stateId} = request.params
    const query = `select sum(cases),sum(cured),sum(active),sum(deaths) from district where state_id="${stateId}"`
    const result = await db.get(query)
    response.send({
      totalCases: result['sum(cases)'],
      totalCured: result['sum(cured)'],
      totalActive: result['sum(active)'],
      totalDeaths: result['sum(deaths)'],
    })
  },
)

module.exports = app
